import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { AppError, asyncHandler } from "../errors.js";
import { validar } from "../validation.js";
import { obtenerViaje } from "./viajes.routes.js";

const router = Router({ mergeParams: true });
const fecha = /^\d{4}-\d{2}-\d{2}$/;
const parte = z.object({
  idParticipante: z.coerce.number().int().positive(),
  importe: z.coerce.number().positive(),
});
const gastoSchema = z
  .object({
    idConceptoPresupuesto: z.coerce
      .number()
      .int()
      .positive()
      .nullable()
      .optional(),
    descripcion: z.string().trim().min(2).max(180),
    categoria: z.string().trim().min(2).max(60),
    fecha: z.string().regex(fecha),
    importe: z.coerce.number().positive(),
    moneda: z.string().regex(/^[A-Z]{3}$/),
    tipoDivision: z.enum(["IGUAL", "PERSONALIZADA"]),
    observaciones: z.string().trim().nullable().optional(),
    pagadores: z.array(parte).min(1),
    asignaciones: z.array(parte).min(1),
  })
  .superRefine((d, ctx) => {
    const suma = (x) => x.reduce((s, p) => s + p.importe, 0);
    if (Math.abs(suma(d.pagadores) - d.importe) >= 0.005)
      ctx.addIssue({
        code: "custom",
        path: ["pagadores"],
        message: "La suma pagada debe coincidir con el gasto.",
      });
    if (Math.abs(suma(d.asignaciones) - d.importe) >= 0.005)
      ctx.addIssue({
        code: "custom",
        path: ["asignaciones"],
        message: "La división debe coincidir con el gasto.",
      });
  });
const transferenciaSchema = z
  .object({
    idOrigen: z.coerce.number().int().positive(),
    idDestino: z.coerce.number().int().positive(),
    importe: z.coerce.number().positive(),
    moneda: z.string().regex(/^[A-Z]{3}$/),
    estado: z.enum(["PENDIENTE", "REALIZADA"]).default("PENDIENTE"),
    fecha: z.string().regex(fecha).nullable().optional(),
  })
  .refine((d) => d.idOrigen !== d.idDestino, {
    message: "Origen y destino deben ser diferentes.",
  });
async function acceso(req) {
  return obtenerViaje(req.params.idViaje, req.usuario.idUsuario);
}
async function participantesViaje(idViaje) {
  const [rows] = await pool.execute(
    "SELECT id_participante AS idParticipante,nombre,color,activo FROM participantes WHERE id_viaje=? ORDER BY nombre",
    [idViaje],
  );
  return rows;
}
async function listarGastos(idViaje) {
  const [rows] = await pool.execute(
    `SELECT g.id_gasto AS idGasto,g.id_concepto_presupuesto AS idConceptoPresupuesto,g.descripcion,g.categoria,DATE_FORMAT(g.fecha,'%Y-%m-%d') AS fecha,g.importe,g.moneda,g.tipo_division AS tipoDivision,g.observaciones FROM gastos g WHERE g.id_viaje=? ORDER BY g.fecha DESC,g.id_gasto DESC`,
    [idViaje],
  );
  for (const g of rows) {
    const [pagadores] = await pool.execute(
      `SELECT p.id_participante AS idParticipante,p.nombre,pg.importe FROM pagadores_gasto pg JOIN participantes p ON p.id_participante=pg.id_participante WHERE pg.id_gasto=?`,
      [g.idGasto],
    );
    const [asignaciones] = await pool.execute(
      `SELECT p.id_participante AS idParticipante,p.nombre,a.importe FROM asignaciones_gasto a JOIN participantes p ON p.id_participante=a.id_participante WHERE a.id_gasto=?`,
      [g.idGasto],
    );
    g.pagadores = pagadores;
    g.asignaciones = asignaciones;
  }
  return rows;
}
async function calcular(idViaje) {
  const participantes = await participantesViaje(idViaje),
    map = {};
  const asegurar = (moneda, id) => {
    map[moneda] ??= {};
    map[moneda][id] ??= 0;
  };
  const sumar = (moneda, id, valor) => {
    asegurar(moneda, id);
    map[moneda][id] += Number(valor);
  };
  const [aportes] = await pool.execute(
    `SELECT pa.moneda,a.id_participante,SUM(a.importe) importe FROM aportes_pago a JOIN pagos pa ON pa.id_pago=a.id_pago JOIN presupuestos pr ON pr.id_presupuesto=pa.id_presupuesto WHERE pr.id_viaje=? AND pa.estado='ACTIVO' GROUP BY pa.moneda,a.id_participante`,
    [idViaje],
  );
  aportes.forEach((x) => sumar(x.moneda, x.id_participante, x.importe));
  const [beneficios] = await pool.execute(
    `SELECT pa.moneda,b.id_participante,SUM(b.importe) importe FROM beneficiarios_pago b JOIN pagos pa ON pa.id_pago=b.id_pago JOIN presupuestos pr ON pr.id_presupuesto=pa.id_presupuesto WHERE pr.id_viaje=? AND pa.estado='ACTIVO' GROUP BY pa.moneda,b.id_participante`,
    [idViaje],
  );
  beneficios.forEach((x) => sumar(x.moneda, x.id_participante, -x.importe));
  const [pagadores] = await pool.execute(
    `SELECT g.moneda,p.id_participante,SUM(p.importe) importe FROM pagadores_gasto p JOIN gastos g ON g.id_gasto=p.id_gasto WHERE g.id_viaje=? GROUP BY g.moneda,p.id_participante`,
    [idViaje],
  );
  pagadores.forEach((x) => sumar(x.moneda, x.id_participante, x.importe));
  const [asignaciones] = await pool.execute(
    `SELECT g.moneda,a.id_participante,SUM(a.importe) importe FROM asignaciones_gasto a JOIN gastos g ON g.id_gasto=a.id_gasto WHERE g.id_viaje=? GROUP BY g.moneda,a.id_participante`,
    [idViaje],
  );
  asignaciones.forEach((x) => sumar(x.moneda, x.id_participante, -x.importe));
  const [transferencias] = await pool.execute(
    `SELECT moneda,id_origen,id_destino,importe FROM transferencias WHERE id_viaje=? AND estado='REALIZADA'`,
    [idViaje],
  );
  transferencias.forEach((t) => {
    sumar(t.moneda, t.id_origen, t.importe);
    sumar(t.moneda, t.id_destino, -t.importe);
  });
  const balances = [];
  const sugerencias = [];
  for (const [moneda, valores] of Object.entries(map)) {
    participantes.forEach((p) => asegurar(moneda, p.idParticipante));
    const lista = participantes.map((p) => ({
      ...p,
      moneda,
      balance: Math.round((map[moneda][p.idParticipante] ?? 0) * 100) / 100,
    }));
    balances.push(...lista);
    const deudores = lista
      .filter((x) => x.balance < -0.009)
      .map((x) => ({ ...x, restante: -x.balance }))
      .sort((a, b) => b.restante - a.restante);
    const acreedores = lista
      .filter((x) => x.balance > 0.009)
      .map((x) => ({ ...x, restante: x.balance }))
      .sort((a, b) => b.restante - a.restante);
    let i = 0,
      j = 0;
    while (i < deudores.length && j < acreedores.length) {
      const importe =
        Math.round(
          Math.min(deudores[i].restante, acreedores[j].restante) * 100,
        ) / 100;
      if (importe > 0)
        sugerencias.push({
          idOrigen: deudores[i].idParticipante,
          origen: deudores[i].nombre,
          idDestino: acreedores[j].idParticipante,
          destino: acreedores[j].nombre,
          importe,
          moneda,
        });
      deudores[i].restante -= importe;
      acreedores[j].restante -= importe;
      if (deudores[i].restante < 0.009) i++;
      if (acreedores[j].restante < 0.009) j++;
    }
  }
  return { participantes, balances, sugerencias };
}
async function respuesta(idViaje) {
  const calculo = await calcular(idViaje);
  const [transferencias] = await pool.execute(
    `SELECT t.id_transferencia AS idTransferencia,t.id_origen AS idOrigen,o.nombre AS origen,t.id_destino AS idDestino,d.nombre AS destino,t.importe,t.moneda,t.estado,DATE_FORMAT(t.fecha,'%Y-%m-%d') AS fecha,t.creado_en AS creadoEn FROM transferencias t JOIN participantes o ON o.id_participante=t.id_origen JOIN participantes d ON d.id_participante=t.id_destino WHERE t.id_viaje=? ORDER BY t.creado_en DESC`,
    [idViaje],
  );
  const [viajes] = await pool.execute(
    "SELECT moneda_principal AS monedaPrincipal FROM viajes WHERE id_viaje=?",
    [idViaje],
  );
  const [tiposCambio] = await pool.execute(
    `SELECT tc.moneda_origen AS monedaOrigen,tc.moneda_destino AS monedaDestino,tc.tasa,DATE_FORMAT(tc.fecha,'%Y-%m-%d') AS fecha FROM tipos_cambio tc WHERE tc.id_viaje=? AND NOT EXISTS (SELECT 1 FROM tipos_cambio nuevo WHERE nuevo.id_viaje=tc.id_viaje AND nuevo.moneda_origen=tc.moneda_origen AND nuevo.moneda_destino=tc.moneda_destino AND (nuevo.fecha>tc.fecha OR (nuevo.fecha=tc.fecha AND nuevo.id_tipo_cambio>tc.id_tipo_cambio)))`,
    [idViaje],
  );
  return {
    ...calculo,
    gastos: await listarGastos(idViaje),
    transferencias,
    monedaPrincipal: viajes[0]?.monedaPrincipal,
    tiposCambio,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    await acceso(req);
    res.json(await respuesta(req.params.idViaje));
  }),
);
router.post(
  "/gastos",
  validar(gastoSchema),
  asyncHandler(async (req, res) => {
    await acceso(req);
    const d = req.body,
      connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      if (d.idConceptoPresupuesto) {
        const [c] = await connection.execute(
          `SELECT cp.id_concepto_presupuesto FROM conceptos_presupuesto cp JOIN presupuestos p ON p.id_presupuesto=cp.id_presupuesto WHERE cp.id_concepto_presupuesto=? AND p.id_viaje=?`,
          [d.idConceptoPresupuesto, req.params.idViaje],
        );
        if (!c[0])
          throw new AppError(400, "El concepto no pertenece al viaje.");
      }
      const [r] = await connection.execute(
        `INSERT INTO gastos (id_viaje,id_concepto_presupuesto,descripcion,categoria,fecha,importe,moneda,tipo_division,observaciones) VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          req.params.idViaje,
          d.idConceptoPresupuesto ?? null,
          d.descripcion,
          d.categoria,
          d.fecha,
          d.importe,
          d.moneda,
          d.tipoDivision,
          d.observaciones ?? null,
        ],
      );
      for (const p of d.pagadores) {
        const [x] = await connection.execute(
          `INSERT INTO pagadores_gasto SELECT ?,id_participante,? FROM participantes WHERE id_participante=? AND id_viaje=?`,
          [r.insertId, p.importe, p.idParticipante, req.params.idViaje],
        );
        if (!x.affectedRows)
          throw new AppError(400, "Una pagadora no pertenece al viaje.");
      }
      for (const a of d.asignaciones) {
        const [x] = await connection.execute(
          `INSERT INTO asignaciones_gasto SELECT ?,id_participante,? FROM participantes WHERE id_participante=? AND id_viaje=?`,
          [r.insertId, a.importe, a.idParticipante, req.params.idViaje],
        );
        if (!x.affectedRows)
          throw new AppError(400, "Una beneficiaria no pertenece al viaje.");
      }
      await connection.commit();
      res.status(201).json(await respuesta(req.params.idViaje));
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }),
);
router.put(
  "/gastos/:idGasto",
  validar(gastoSchema),
  asyncHandler(async (req, res) => {
    await acceso(req);
    const d = req.body,
      connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [actualizado] = await connection.execute(
        `UPDATE gastos SET id_concepto_presupuesto=?,descripcion=?,categoria=?,fecha=?,importe=?,moneda=?,tipo_division=?,observaciones=? WHERE id_gasto=? AND id_viaje=?`,
        [d.idConceptoPresupuesto??null,d.descripcion,d.categoria,d.fecha,d.importe,d.moneda,d.tipoDivision,d.observaciones??null,req.params.idGasto,req.params.idViaje],
      );
      if (!actualizado.affectedRows) throw new AppError(404, "Gasto no encontrado.");
      await connection.execute("DELETE FROM pagadores_gasto WHERE id_gasto=?", [req.params.idGasto]);
      await connection.execute("DELETE FROM asignaciones_gasto WHERE id_gasto=?", [req.params.idGasto]);
      for (const p of d.pagadores) {
        const [x] = await connection.execute(`INSERT INTO pagadores_gasto SELECT ?,id_participante,? FROM participantes WHERE id_participante=? AND id_viaje=?`,[req.params.idGasto,p.importe,p.idParticipante,req.params.idViaje]);
        if (!x.affectedRows) throw new AppError(400, "Una pagadora no pertenece al viaje.");
      }
      for (const a of d.asignaciones) {
        const [x] = await connection.execute(`INSERT INTO asignaciones_gasto SELECT ?,id_participante,? FROM participantes WHERE id_participante=? AND id_viaje=?`,[req.params.idGasto,a.importe,a.idParticipante,req.params.idViaje]);
        if (!x.affectedRows) throw new AppError(400, "Una beneficiaria no pertenece al viaje.");
      }
      await connection.commit();
      res.json(await respuesta(req.params.idViaje));
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally { connection.release(); }
  }),
);
router.delete(
  "/gastos/:idGasto",
  asyncHandler(async (req, res) => {
    await acceso(req);
    const [r] = await pool.execute(
      "DELETE FROM gastos WHERE id_gasto=? AND id_viaje=?",
      [req.params.idGasto, req.params.idViaje],
    );
    if (!r.affectedRows) throw new AppError(404, "Gasto no encontrado.");
    res.status(204).end();
  }),
);
router.post(
  "/transferencias",
  validar(transferenciaSchema),
  asyncHandler(async (req, res) => {
    await acceso(req);
    const d = req.body;
    const [validos] = await pool.execute(
      `SELECT COUNT(*) cantidad FROM participantes WHERE id_viaje=? AND id_participante IN (?,?)`,
      [req.params.idViaje, d.idOrigen, d.idDestino],
    );
    if (Number(validos[0].cantidad) !== 2)
      throw new AppError(400, "Las participantes no pertenecen al viaje.");
    const [r] = await pool.execute(
      `INSERT INTO transferencias (id_viaje,id_origen,id_destino,importe,moneda,estado,fecha) VALUES (?,?,?,?,?,?,?)`,
      [
        req.params.idViaje,
        d.idOrigen,
        d.idDestino,
        d.importe,
        d.moneda,
        d.estado,
        d.fecha ?? null,
      ],
    );
    res.status(201).json({ idTransferencia: Number(r.insertId), ...d });
  }),
);
router.patch(
  "/transferencias/:idTransferencia",
  validar(
    z.object({
      estado: z.enum(["PENDIENTE", "REALIZADA", "ANULADA"]),
      fecha: z.string().regex(fecha).nullable().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    await acceso(req);
    const [r] = await pool.execute(
      "UPDATE transferencias SET estado=?,fecha=? WHERE id_transferencia=? AND id_viaje=?",
      [
        req.body.estado,
        req.body.fecha ?? null,
        req.params.idTransferencia,
        req.params.idViaje,
      ],
    );
    if (!r.affectedRows)
      throw new AppError(404, "Transferencia no encontrada.");
    res.json({
      idTransferencia: Number(req.params.idTransferencia),
      ...req.body,
    });
  }),
);
export default router;
