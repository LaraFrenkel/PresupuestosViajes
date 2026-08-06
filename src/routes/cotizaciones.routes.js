import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { AppError, asyncHandler } from "../errors.js";
import { validar } from "../validation.js";
import { obtenerViaje } from "./viajes.routes.js";

const router = Router({ mergeParams: true });
const fecha = /^\d{4}-\d{2}-\d{2}$/;
const cotizacionSchema = z.object({
  agencia: z.string().trim().min(2).max(120),
  naviera: z.string().trim().max(100).nullable().optional(),
  barco: z.string().trim().max(100).nullable().optional(),
  fechaCotizacion: z.string().regex(fecha),
  duracionNoches: z.coerce
    .number()
    .int()
    .positive()
    .max(365)
    .nullable()
    .optional(),
  itinerario: z.string().trim().nullable().optional(),
  tipoCamarote: z.string().trim().max(100).nullable().optional(),
  distribucion: z.string().trim().max(255).nullable().optional(),
  moneda: z.string().regex(/^[A-Z]{3}$/),
  precioCotizado: z.coerce.number().nonnegative().nullable().optional(),
  modalidadPrecio: z.enum(["TOTAL", "POR_PERSONA"]).default("TOTAL"),
  referencia: z.string().trim().max(500).nullable().optional(),
  vigenteHasta: z.string().regex(fecha).nullable().optional(),
  estado: z.enum(["BORRADOR", "COMPLETA"]).default("BORRADOR"),
});
const cotizacionEdicionSchema = cotizacionSchema.extend({
  estado: z.enum(["BORRADOR", "COMPLETA", "SELECCIONADA"]),
});
const conceptoSchema = z
  .object({
    categoria: z.string().trim().min(2).max(60),
    descripcion: z.string().trim().min(2).max(180),
    importe: z.coerce.number().nonnegative(),
    moneda: z.string().regex(/^[A-Z]{3}$/),
    modalidad: z.enum([
      "TOTAL",
      "POR_PERSONA",
      "POR_CAMAROTE",
      "POR_NOCHE",
      "POR_PERSONA_NOCHE",
    ]),
    cantidad: z.coerce.number().positive().default(1),
    obligatorio: z.boolean().default(false),
    opcionalSeleccionado: z.boolean().default(true),
    incluido: z.boolean().default(false),
    aplicaTodos: z.boolean().default(true),
    participanteIds: z.array(z.coerce.number().int().positive()).default([]),
  })
  .refine((d) => d.aplicaTodos || d.participanteIds.length > 0, {
    message: "Seleccioná al menos una participante.",
    path: ["participanteIds"],
  });
const tipoCambioSchema = z.object({
  monedaOrigen: z.string().regex(/^[A-Z]{3}$/),
  tasa: z.coerce.number().positive(),
  fecha: z.string().regex(fecha),
});

async function comprobarAcceso(req) {
  return obtenerViaje(req.params.idViaje, req.usuario.idUsuario);
}

async function obtenerCotizacion(idCotizacion, idViaje) {
  const [rows] = await pool.execute(
    `SELECT id_cotizacion AS idCotizacion, agencia, naviera, barco,
      DATE_FORMAT(fecha_cotizacion, '%Y-%m-%d') AS fechaCotizacion,
      duracion_noches AS duracionNoches, itinerario, tipo_camarote AS tipoCamarote,
      distribucion, moneda, precio_cotizado AS precioCotizado,
      modalidad_precio AS modalidadPrecio, referencia,
      DATE_FORMAT(vigente_hasta, '%Y-%m-%d') AS vigenteHasta,
      estado, creado_en AS creadoEn
     FROM cotizaciones WHERE id_cotizacion = ? AND id_viaje = ?`,
    [idCotizacion, idViaje],
  );
  if (!rows[0]) throw new AppError(404, "Cotización no encontrada.");
  return rows[0];
}

async function obtenerConceptos(idCotizacion) {
  const [rows] = await pool.execute(
    `SELECT c.id_concepto AS idConcepto, c.categoria, c.descripcion, c.importe, c.moneda,
      c.modalidad, c.cantidad, c.obligatorio, c.opcional_seleccionado AS opcionalSeleccionado,
      c.incluido, c.aplica_todos AS aplicaTodos,
      GROUP_CONCAT(a.id_participante ORDER BY a.id_participante) AS participanteIds
     FROM conceptos_cotizacion c
     LEFT JOIN asignaciones_concepto a ON a.id_concepto = c.id_concepto
     WHERE c.id_cotizacion = ? GROUP BY c.id_concepto ORDER BY c.id_concepto`,
    [idCotizacion],
  );
  return rows.map((r) => ({
    ...r,
    participanteIds: r.participanteIds
      ? r.participanteIds.split(",").map(Number)
      : [],
  }));
}

function calcularConcepto(concepto, cantidadParticipantes, noches) {
  if (
    concepto.incluido ||
    (!concepto.obligatorio && !concepto.opcionalSeleccionado)
  )
    return 0;
  const personas = concepto.aplicaTodos
    ? cantidadParticipantes
    : concepto.participanteIds.length;
  const factores = {
    TOTAL: concepto.cantidad,
    POR_PERSONA: personas * concepto.cantidad,
    POR_CAMAROTE: concepto.cantidad,
    POR_NOCHE: noches * concepto.cantidad,
    POR_PERSONA_NOCHE: personas * noches * concepto.cantidad,
  };
  return Number(concepto.importe) * factores[concepto.modalidad];
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    await comprobarAcceso(req);
    const [rows] = await pool.execute(
      `SELECT c.id_cotizacion AS idCotizacion, c.agencia, c.naviera, c.barco,
      DATE_FORMAT(c.fecha_cotizacion, '%Y-%m-%d') AS fechaCotizacion,
      c.duracion_noches AS duracionNoches, c.tipo_camarote AS tipoCamarote, c.moneda,
      c.precio_cotizado AS precioCotizado, c.modalidad_precio AS modalidadPrecio,
      DATE_FORMAT(c.vigente_hasta, '%Y-%m-%d') AS vigenteHasta, c.estado,
      COUNT(cc.id_concepto) AS cantidadConceptos
     FROM cotizaciones c LEFT JOIN conceptos_cotizacion cc ON cc.id_cotizacion = c.id_cotizacion
     WHERE c.id_viaje = ? GROUP BY c.id_cotizacion ORDER BY c.creado_en DESC`,
      [req.params.idViaje],
    );
    res.json(rows);
  }),
);

router.post(
  "/",
  validar(cotizacionSchema),
  asyncHandler(async (req, res) => {
    await comprobarAcceso(req);
    const d = req.body;
    const [result] = await pool.execute(
      `INSERT INTO cotizaciones (id_viaje, agencia, naviera, barco, fecha_cotizacion, duracion_noches,
      itinerario, tipo_camarote, distribucion, moneda, precio_cotizado,
      modalidad_precio, referencia, vigente_hasta, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.idViaje,
        d.agencia,
        d.naviera ?? null,
        d.barco ?? null,
        d.fechaCotizacion,
        d.duracionNoches ?? null,
        d.itinerario ?? null,
        d.tipoCamarote ?? null,
        d.distribucion ?? null,
        d.moneda,
        d.precioCotizado ?? null,
        d.modalidadPrecio,
        d.referencia ?? null,
        d.vigenteHasta ?? null,
        d.estado,
      ],
    );
    res
      .status(201)
      .json(await obtenerCotizacion(result.insertId, req.params.idViaje));
  }),
);

router.get(
  "/comparacion",
  asyncHandler(async (req, res) => {
    const viaje = await comprobarAcceso(req);
    const [participantes] = await pool.execute(
      "SELECT id_participante AS idParticipante, nombre FROM participantes WHERE id_viaje = ? AND activo = TRUE ORDER BY nombre",
      [req.params.idViaje],
    );
    const [cotizaciones] = await pool.execute(
      "SELECT id_cotizacion AS idCotizacion FROM cotizaciones WHERE id_viaje = ? ORDER BY creado_en",
      [req.params.idViaje],
    );
    const [cambios] = await pool.execute(
      `SELECT moneda_origen AS monedaOrigen, tasa FROM tipos_cambio
     WHERE id_viaje = ? AND moneda_destino = ? ORDER BY fecha DESC, id_tipo_cambio DESC`,
      [req.params.idViaje, viaje.monedaPrincipal],
    );
    const tasas = Object.fromEntries(
      cambios.map((c) => [c.monedaOrigen, Number(c.tasa)]),
    );
    const resultado = [];
    for (const item of cotizaciones) {
      const cotizacion = await obtenerCotizacion(
        item.idCotizacion,
        req.params.idViaje,
      );
      const conceptos = await obtenerConceptos(item.idCotizacion);
      const noches = Number(cotizacion.duracionNoches ?? 1);
      let totalPrincipal = 0;
      let incompleta = false;
      const totalesPorMoneda = {};
      const porParticipante = Object.fromEntries(
        participantes.map((p) => [p.idParticipante, 0]),
      );
      const precioCotizado = Number(cotizacion.precioCotizado ?? 0);
      const totalPrecioCotizado =
        cotizacion.modalidadPrecio === "POR_PERSONA"
          ? precioCotizado * participantes.length
          : precioCotizado;
      if (totalPrecioCotizado) {
        totalesPorMoneda[cotizacion.moneda] = totalPrecioCotizado;
        const tasaBase =
          cotizacion.moneda === viaje.monedaPrincipal
            ? 1
            : tasas[cotizacion.moneda];
        if (!tasaBase) incompleta = true;
        else {
          totalPrincipal += totalPrecioCotizado * tasaBase;
          const parte = participantes.length
            ? (totalPrecioCotizado * tasaBase) / participantes.length
            : 0;
          participantes.forEach((participante) => {
            porParticipante[participante.idParticipante] += parte;
          });
        }
      }
      const detalle = conceptos.map((c) => {
        const total = calcularConcepto(c, participantes.length, noches);
        totalesPorMoneda[c.moneda] = (totalesPorMoneda[c.moneda] ?? 0) + total;
        const tasa = c.moneda === viaje.monedaPrincipal ? 1 : tasas[c.moneda];
        if (!tasa && total) incompleta = true;
        else totalPrincipal += total * (tasa ?? 0);
        const ids = c.aplicaTodos
          ? participantes.map((p) => p.idParticipante)
          : c.participanteIds;
        const partePrincipal =
          ids.length && tasa ? (total * tasa) / ids.length : 0;
        ids.forEach((id) => {
          if (id in porParticipante) porParticipante[id] += partePrincipal;
        });
        return {
          ...c,
          total,
          tasa: tasa ?? null,
          totalPrincipal: tasa ? total * tasa : null,
        };
      });
      resultado.push({
        ...cotizacion,
        conceptos: detalle,
        totalesPorMoneda,
        totalPrincipal,
        porParticipante,
        incompleta,
      });
    }
    res.json({
      monedaPrincipal: viaje.monedaPrincipal,
      participantes,
      cotizaciones: resultado,
    });
  }),
);

router.get(
  "/tipos-cambio",
  asyncHandler(async (req, res) => {
    const viaje = await comprobarAcceso(req);
    const [rows] = await pool.execute(
      `SELECT id_tipo_cambio AS idTipoCambio, moneda_origen AS monedaOrigen,
      moneda_destino AS monedaDestino, tasa, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha
     FROM tipos_cambio WHERE id_viaje = ? ORDER BY fecha DESC`,
      [req.params.idViaje],
    );
    res.json({ monedaPrincipal: viaje.monedaPrincipal, tiposCambio: rows });
  }),
);

router.post(
  "/tipos-cambio",
  validar(tipoCambioSchema),
  asyncHandler(async (req, res) => {
    const viaje = await comprobarAcceso(req);
    const d = req.body;
    const [result] = await pool.execute(
      `INSERT INTO tipos_cambio (id_viaje, moneda_origen, moneda_destino, tasa, fecha)
     VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE tasa = VALUES(tasa)`,
      [
        req.params.idViaje,
        d.monedaOrigen,
        viaje.monedaPrincipal,
        d.tasa,
        d.fecha,
      ],
    );
    res
      .status(201)
      .json({
        idTipoCambio: Number(result.insertId),
        ...d,
        monedaDestino: viaje.monedaPrincipal,
      });
  }),
);

router.get(
  "/:idCotizacion",
  asyncHandler(async (req, res) => {
    await comprobarAcceso(req);
    const item = await obtenerCotizacion(
      req.params.idCotizacion,
      req.params.idViaje,
    );
    item.conceptos = await obtenerConceptos(req.params.idCotizacion);
    res.json(item);
  }),
);

router.put(
  "/:idCotizacion",
  validar(cotizacionEdicionSchema),
  asyncHandler(async (req, res) => {
    await comprobarAcceso(req);
    await obtenerCotizacion(req.params.idCotizacion, req.params.idViaje);
    const d = req.body;
    await pool.execute(
      `UPDATE cotizaciones SET agencia=?, naviera=?, barco=?, fecha_cotizacion=?, duracion_noches=?, itinerario=?,
      tipo_camarote=?, distribucion=?, moneda=?, precio_cotizado=?,
      modalidad_precio=?, referencia=?, vigente_hasta=?, estado=? WHERE id_cotizacion=? AND id_viaje=?`,
      [
        d.agencia,
        d.naviera ?? null,
        d.barco ?? null,
        d.fechaCotizacion,
        d.duracionNoches ?? null,
        d.itinerario ?? null,
        d.tipoCamarote ?? null,
        d.distribucion ?? null,
        d.moneda,
        d.precioCotizado ?? null,
        d.modalidadPrecio,
        d.referencia ?? null,
        d.vigenteHasta ?? null,
        d.estado,
        req.params.idCotizacion,
        req.params.idViaje,
      ],
    );
    res.json(
      await obtenerCotizacion(req.params.idCotizacion, req.params.idViaje),
    );
  }),
);

router.post(
  "/:idCotizacion/duplicar",
  asyncHandler(async (req, res) => {
    await comprobarAcceso(req);
    const original = await obtenerCotizacion(
      req.params.idCotizacion,
      req.params.idViaje,
    );
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        `INSERT INTO cotizaciones (id_viaje, agencia, naviera, barco, fecha_cotizacion, duracion_noches, itinerario,
       tipo_camarote, distribucion, moneda, precio_cotizado, modalidad_precio,
       referencia, vigente_hasta, estado)
       SELECT id_viaje, CONCAT(agencia, ' — copia'), naviera, barco, fecha_cotizacion, duracion_noches, itinerario,
       tipo_camarote, distribucion, moneda, precio_cotizado, modalidad_precio,
       referencia, vigente_hasta, 'BORRADOR'
       FROM cotizaciones WHERE id_cotizacion = ?`,
        [original.idCotizacion],
      );
      const [conceptos] = await connection.execute(
        "SELECT * FROM conceptos_cotizacion WHERE id_cotizacion = ?",
        [original.idCotizacion],
      );
      for (const c of conceptos) {
        const [nuevo] = await connection.execute(
          `INSERT INTO conceptos_cotizacion (id_cotizacion,categoria,descripcion,importe,moneda,modalidad,cantidad,obligatorio,opcional_seleccionado,incluido,aplica_todos)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [
            result.insertId,
            c.categoria,
            c.descripcion,
            c.importe,
            c.moneda,
            c.modalidad,
            c.cantidad,
            c.obligatorio,
            c.opcional_seleccionado,
            c.incluido,
            c.aplica_todos,
          ],
        );
        await connection.execute(
          `INSERT INTO asignaciones_concepto (id_concepto,id_participante)
         SELECT ?, id_participante FROM asignaciones_concepto WHERE id_concepto = ?`,
          [nuevo.insertId, c.id_concepto],
        );
      }
      await connection.commit();
      res
        .status(201)
        .json(await obtenerCotizacion(result.insertId, req.params.idViaje));
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }),
);

router.delete(
  "/:idCotizacion",
  asyncHandler(async (req, res) => {
    await comprobarAcceso(req);
    const [result] = await pool.execute(
      "DELETE FROM cotizaciones WHERE id_cotizacion = ? AND id_viaje = ?",
      [req.params.idCotizacion, req.params.idViaje],
    );
    if (!result.affectedRows)
      throw new AppError(404, "Cotización no encontrada.");
    res.status(204).end();
  }),
);

async function guardarConcepto(req, res, idConcepto = null) {
  await comprobarAcceso(req);
  const cotizacion = await obtenerCotizacion(
    req.params.idCotizacion,
    req.params.idViaje,
  );
  const d = req.body;
  if (d.incluido && cotizacion.precioCotizado === null)
    throw new AppError(
      400,
      "Cargá el precio cotizado antes de marcar conceptos como incluidos.",
    );
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let id = idConcepto;
    if (id) {
      const [result] = await connection.execute(
        `UPDATE conceptos_cotizacion SET categoria=?,descripcion=?,importe=?,moneda=?,modalidad=?,cantidad=?,obligatorio=?,opcional_seleccionado=?,incluido=?,aplica_todos=?
         WHERE id_concepto=? AND id_cotizacion=?`,
        [
          d.categoria,
          d.descripcion,
          d.importe,
          d.moneda,
          d.modalidad,
          d.cantidad,
          d.obligatorio,
          d.opcionalSeleccionado,
          d.incluido,
          d.aplicaTodos,
          id,
          req.params.idCotizacion,
        ],
      );
      if (!result.affectedRows)
        throw new AppError(404, "Concepto no encontrado.");
      await connection.execute(
        "DELETE FROM asignaciones_concepto WHERE id_concepto = ?",
        [id],
      );
    } else {
      const [result] = await connection.execute(
        `INSERT INTO conceptos_cotizacion (id_cotizacion,categoria,descripcion,importe,moneda,modalidad,cantidad,obligatorio,opcional_seleccionado,incluido,aplica_todos)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          req.params.idCotizacion,
          d.categoria,
          d.descripcion,
          d.importe,
          d.moneda,
          d.modalidad,
          d.cantidad,
          d.obligatorio,
          d.opcionalSeleccionado,
          d.incluido,
          d.aplicaTodos,
        ],
      );
      id = result.insertId;
    }
    if (!d.aplicaTodos)
      for (const participanteId of d.participanteIds) {
        await connection.execute(
          `INSERT INTO asignaciones_concepto (id_concepto,id_participante)
         SELECT ?, id_participante FROM participantes WHERE id_participante=? AND id_viaje=? AND activo=TRUE`,
          [id, participanteId, req.params.idViaje],
        );
      }
    await connection.commit();
    const conceptos = await obtenerConceptos(req.params.idCotizacion);
    res
      .status(idConcepto ? 200 : 201)
      .json(conceptos.find((c) => Number(c.idConcepto) === Number(id)));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

router.post(
  "/:idCotizacion/conceptos",
  validar(conceptoSchema),
  asyncHandler((req, res) => guardarConcepto(req, res)),
);
router.put(
  "/:idCotizacion/conceptos/:idConcepto",
  validar(conceptoSchema),
  asyncHandler((req, res) => guardarConcepto(req, res, req.params.idConcepto)),
);
router.delete(
  "/:idCotizacion/conceptos/:idConcepto",
  asyncHandler(async (req, res) => {
    await comprobarAcceso(req);
    await obtenerCotizacion(req.params.idCotizacion, req.params.idViaje);
    const [result] = await pool.execute(
      "DELETE FROM conceptos_cotizacion WHERE id_concepto=? AND id_cotizacion=?",
      [req.params.idConcepto, req.params.idCotizacion],
    );
    if (!result.affectedRows)
      throw new AppError(404, "Concepto no encontrado.");
    res.status(204).end();
  }),
);

export default router;
