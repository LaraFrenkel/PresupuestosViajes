import assert from "node:assert/strict";
import request from "supertest";
import { app } from "../src/app.js";
import { pool } from "../src/db.js";

const marca = Date.now();
const email = `prueba-integral-${marca}@example.com`;
let idUsuario;
let idViaje;

function ok(response, status, paso) {
  assert.equal(
    response.status,
    status,
    `${paso}: ${response.status} ${JSON.stringify(response.body)}`,
  );
  return response.body;
}

async function limpiarViaje(id) {
  await pool.execute(
    `DELETE ac FROM asignaciones_concepto ac JOIN conceptos_cotizacion cc ON cc.id_concepto=ac.id_concepto JOIN cotizaciones c ON c.id_cotizacion=cc.id_cotizacion WHERE c.id_viaje=?`,
    [id],
  );
  await pool.execute(
    `DELETE ap FROM asignaciones_presupuesto ap JOIN conceptos_presupuesto cp ON cp.id_concepto_presupuesto=ap.id_concepto_presupuesto JOIN presupuestos p ON p.id_presupuesto=cp.id_presupuesto WHERE p.id_viaje=?`,
    [id],
  );
  await pool.execute(
    `DELETE pe FROM participantes_excursion pe JOIN excursiones e ON e.id_excursion=pe.id_excursion JOIN presupuestos p ON p.id_presupuesto=e.id_presupuesto WHERE p.id_viaje=?`,
    [id],
  );
  await pool.execute(
    `DELETE ap FROM aplicaciones_pago ap JOIN pagos pg ON pg.id_pago=ap.id_pago JOIN presupuestos p ON p.id_presupuesto=pg.id_presupuesto WHERE p.id_viaje=?`,
    [id],
  );
  await pool.execute(
    `DELETE a FROM aportes_pago a JOIN pagos pg ON pg.id_pago=a.id_pago JOIN presupuestos p ON p.id_presupuesto=pg.id_presupuesto WHERE p.id_viaje=?`,
    [id],
  );
  await pool.execute(
    `DELETE b FROM beneficiarios_pago b JOIN pagos pg ON pg.id_pago=b.id_pago JOIN presupuestos p ON p.id_presupuesto=pg.id_presupuesto WHERE p.id_viaje=?`,
    [id],
  );
  await pool.execute(
    `DELETE pg FROM pagadores_gasto pg JOIN gastos g ON g.id_gasto=pg.id_gasto WHERE g.id_viaje=?`,
    [id],
  );
  await pool.execute(
    `DELETE ag FROM asignaciones_gasto ag JOIN gastos g ON g.id_gasto=ag.id_gasto WHERE g.id_viaje=?`,
    [id],
  );
  await pool.execute("DELETE FROM transferencias WHERE id_viaje=?", [id]);
  await pool.execute("DELETE FROM viajes WHERE id_viaje=?", [id]);
}

async function limpiarPruebasInterrumpidas() {
  const [usuarios] = await pool.execute(
    "SELECT id_usuario AS idUsuario FROM usuarios WHERE email LIKE 'prueba-integral-%@example.com'",
  );
  for (const usuario of usuarios) {
    const [viajes] = await pool.execute(
      "SELECT id_viaje AS idViaje FROM viajes WHERE id_usuario=?",
      [usuario.idUsuario],
    );
    for (const viaje of viajes) await limpiarViaje(viaje.idViaje);
    await pool.execute("DELETE FROM usuarios WHERE id_usuario=?", [
      usuario.idUsuario,
    ]);
  }
}

try {
  await limpiarPruebasInterrumpidas();
  const registro = ok(
    await request(app).post("/api/auth/registro").send({
      nombre: "Prueba integral",
      email,
      contrasena: "Prueba-1234",
    }),
    201,
    "registro",
  );
  idUsuario = registro.idUsuario;

  const login = ok(
    await request(app).post("/api/auth/login").send({
      email,
      contrasena: "Prueba-1234",
    }),
    200,
    "login",
  );
  const api = request(app);
  const auth = { Authorization: `Bearer ${login.token}` };

  const viaje = ok(
    await api.post("/api/viajes").set(auth).send({
      nombre: "Viaje temporal QA",
      tipoViaje: "CRUCERO",
      fechaSalida: "2027-01-05",
      fechaRegreso: "2027-01-14",
      monedaPrincipal: "USD",
      estado: "PLANIFICACION",
    }),
    201,
    "crear viaje",
  );
  idViaje = viaje.idViaje;

  const p1 = ok(
    await api
      .post(`/api/viajes/${idViaje}/participantes`)
      .set(auth)
      .send({ nombre: "Ana", color: "#829c98" }),
    201,
    "participante Ana",
  );
  const p2 = ok(
    await api
      .post(`/api/viajes/${idViaje}/participantes`)
      .set(auth)
      .send({ nombre: "Berta", color: "#c98b76" }),
    201,
    "participante Berta",
  );

  const cotizacion = ok(
    await api.post(`/api/viajes/${idViaje}/cotizaciones`).set(auth).send({
      agencia: "Agencia QA",
      fechaCotizacion: "2026-08-03",
      duracionNoches: 9,
      moneda: "USD",
      estado: "COMPLETA",
    }),
    201,
    "crear cotización",
  );

  const concepto = ok(
    await api
      .post(
        `/api/viajes/${idViaje}/cotizaciones/${cotizacion.idCotizacion}/conceptos`,
      )
      .set(auth)
      .send({
        categoria: "Tarifa base",
        descripcion: "Paquete completo",
        importe: 300,
        moneda: "USD",
        modalidad: "TOTAL",
        cantidad: 1,
        obligatorio: true,
        opcionalSeleccionado: true,
        incluido: false,
        aplicaTodos: true,
        participanteIds: [],
      }),
    201,
    "crear concepto",
  );

  ok(
    await api
      .put(
        `/api/viajes/${idViaje}/cotizaciones/${cotizacion.idCotizacion}/conceptos/${concepto.idConcepto}`,
      )
      .set(auth)
      .send({
        ...concepto,
        descripcion: "Paquete completo editado",
        importe: 300,
        obligatorio: Boolean(concepto.obligatorio),
        opcionalSeleccionado: Boolean(concepto.opcionalSeleccionado),
        incluido: Boolean(concepto.incluido),
        aplicaTodos: Boolean(concepto.aplicaTodos),
      }),
    200,
    "editar concepto",
  );

  ok(
    await api
      .post(`/api/viajes/${idViaje}/presupuesto/confirmar`)
      .set(auth)
      .send({ idCotizacion: cotizacion.idCotizacion }),
    201,
    "confirmar presupuesto",
  );
  const presupuesto = ok(
    await api.get(`/api/viajes/${idViaje}/presupuesto`).set(auth),
    200,
    "leer presupuesto",
  );

  const cuota = ok(
    await api.post(`/api/viajes/${idViaje}/presupuesto/cuotas`).set(auth).send({
      idConceptoPresupuesto: presupuesto.conceptos[0].idConceptoPresupuesto,
      descripcion: "Pago total",
      importe: 300,
      moneda: "USD",
      fechaVencimiento: "2026-09-01",
      estado: "PENDIENTE",
    }),
    201,
    "crear cuota",
  );

  ok(
    await api
      .post(`/api/viajes/${idViaje}/presupuesto/pagos`)
      .set(auth)
      .send({
        fecha: "2026-08-03",
        importe: 300,
        moneda: "USD",
        medio: "Transferencia",
        aportes: [{ idParticipante: p1.idParticipante, importe: 300 }],
        beneficiarios: [
          { idParticipante: p1.idParticipante, importe: 150 },
          { idParticipante: p2.idParticipante, importe: 150 },
        ],
        aplicaciones: [{ idCuota: cuota.idCuota, importe: 300 }],
      }),
    201,
    "registrar pago",
  );

  ok(
    await api
      .post(`/api/viajes/${idViaje}/finanzas/gastos`)
      .set(auth)
      .send({
        descripcion: "Cena grupal",
        categoria: "Comida",
        fecha: "2026-08-03",
        importe: 100,
        moneda: "USD",
        tipoDivision: "IGUAL",
        pagadores: [{ idParticipante: p2.idParticipante, importe: 100 }],
        asignaciones: [
          { idParticipante: p1.idParticipante, importe: 50 },
          { idParticipante: p2.idParticipante, importe: 50 },
        ],
      }),
    201,
    "registrar gasto",
  );

  const finanzas = ok(
    await api.get(`/api/viajes/${idViaje}/finanzas`).set(auth),
    200,
    "calcular balances",
  );
  assert.equal(
    finanzas.sugerencias.length,
    1,
    "debe sugerir una transferencia",
  );
  const sugerida = finanzas.sugerencias[0];
  ok(
    await api
      .post(`/api/viajes/${idViaje}/finanzas/transferencias`)
      .set(auth)
      .send({
        idOrigen: sugerida.idOrigen,
        idDestino: sugerida.idDestino,
        importe: sugerida.importe,
        moneda: sugerida.moneda,
        estado: "REALIZADA",
        fecha: "2026-08-03",
      }),
    201,
    "registrar transferencia",
  );

  const saldado = ok(
    await api.get(`/api/viajes/${idViaje}/finanzas`).set(auth),
    200,
    "recalcular balances",
  );
  assert.equal(
    saldado.sugerencias.length,
    0,
    "la transferencia realizada debe saldar el balance",
  );

  ok(
    await api.delete(`/api/viajes/${idViaje}/permanente`).set(auth),
    200,
    "eliminar viaje temporal",
  );
  idViaje = null;
  console.log(
    "✓ Flujo integral completado: usuario, viaje, cotización, presupuesto, cuota, pago, gasto, balance y transferencia.",
  );
} finally {
  if (idViaje) await limpiarViaje(idViaje);
  if (idUsuario)
    await pool.execute("DELETE FROM usuarios WHERE id_usuario=?", [idUsuario]);
  await pool.end();
}
