import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { AppError, asyncHandler } from "../errors.js";
import { validar } from "../validation.js";
import { obtenerViaje } from "./viajes.routes.js";

const router = Router({ mergeParams: true });
const fecha = /^\d{4}-\d{2}-\d{2}$/;
const estadosConcepto = [
  "ESTIMADO",
  "CONFIRMADO",
  "PENDIENTE",
  "PAGADO",
  "CANCELADO",
];
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
    estado: z.enum(estadosConcepto).default("CONFIRMADO"),
    aplicaTodos: z.boolean().default(true),
    participanteIds: z.array(z.coerce.number().int().positive()).default([]),
  })
  .refine((d) => d.aplicaTodos || d.participanteIds.length > 0, {
    message: "Seleccioná participantes.",
    path: ["participanteIds"],
  });
const excursionSchema = z.object({
  puerto: z.string().trim().min(2).max(120),
  fecha: z.string().regex(fecha).nullable().optional(),
  hora: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  proveedor: z.string().trim().max(120).nullable().optional(),
  duracion: z.string().trim().max(80).nullable().optional(),
  descripcion: z.string().trim().min(2).max(180),
  importe: z.coerce.number().nonnegative(),
  moneda: z.string().regex(/^[A-Z]{3}$/),
  referencia: z.string().trim().max(500).nullable().optional(),
  politicaCancelacion: z.string().trim().nullable().optional(),
  estado: z
    .enum(["ALTERNATIVA", "ELEGIDA", "CANCELADA"])
    .default("ALTERNATIVA"),
  participanteIds: z.array(z.coerce.number().int().positive()).min(1),
});
const cuotaSchema = z.object({
  idConceptoPresupuesto: z.coerce
    .number()
    .int()
    .positive()
    .nullable()
    .optional(),
  descripcion: z.string().trim().min(2).max(180),
  importe: z.coerce.number().positive(),
  moneda: z.string().regex(/^[A-Z]{3}$/),
  fechaVencimiento: z.string().regex(fecha),
  estado: z
    .enum(["PENDIENTE", "PAGADA", "VENCIDA", "CANCELADA"])
    .default("PENDIENTE"),
});
const pagoSchema = z
  .object({
    fecha: z.string().regex(fecha),
    importe: z.coerce.number().positive(),
    moneda: z.string().regex(/^[A-Z]{3}$/),
    medio: z.string().trim().max(80).nullable().optional(),
    tipoCambio: z.coerce.number().positive().nullable().optional(),
    observaciones: z.string().trim().nullable().optional(),
    aportes: z
      .array(
        z.object({
          idParticipante: z.coerce.number().int().positive(),
          importe: z.coerce.number().positive(),
        }),
      )
      .min(1),
    beneficiarios: z
      .array(
        z.object({
          idParticipante: z.coerce.number().int().positive(),
          importe: z.coerce.number().positive(),
        }),
      )
      .min(1),
    aplicaciones: z
      .array(
        z
          .object({
            idCuota: z.coerce.number().int().positive().nullable().optional(),
            idConceptoPresupuesto: z.coerce
              .number()
              .int()
              .positive()
              .nullable()
              .optional(),
            importe: z.coerce.number().positive(),
          })
          .refine((a) => a.idCuota || a.idConceptoPresupuesto, {
            message: "La aplicación necesita una cuota o concepto.",
          }),
      )
      .min(1),
  })
  .superRefine((d, ctx) => {
    const iguales = (items) =>
      Math.abs(items.reduce((s, x) => s + x.importe, 0) - d.importe) < 0.005;
    if (!iguales(d.aportes))
      ctx.addIssue({
        code: "custom",
        path: ["aportes"],
        message: "La suma de aportes debe coincidir con el pago.",
      });
    if (!iguales(d.beneficiarios))
      ctx.addIssue({
        code: "custom",
        path: ["beneficiarios"],
        message: "La suma asignada debe coincidir con el pago.",
      });
    if (!iguales(d.aplicaciones))
      ctx.addIssue({
        code: "custom",
        path: ["aplicaciones"],
        message: "La suma aplicada debe coincidir con el pago.",
      });
  });

async function acceso(req) {
  return obtenerViaje(req.params.idViaje, req.usuario.idUsuario);
}
async function presupuestoActivo(idViaje) {
  const [rows] = await pool.execute(
    `SELECT id_presupuesto AS idPresupuesto,id_cotizacion_origen AS idCotizacionOrigen,version,nombre,estado,creado_en AS creadoEn FROM presupuestos WHERE id_viaje=? AND activo=TRUE ORDER BY version DESC LIMIT 1`,
    [idViaje],
  );
  if (!rows[0])
    throw new AppError(404, "Todavía no hay un presupuesto confirmado.");
  return rows[0];
}
async function detalle(idViaje) {
  const p = await presupuestoActivo(idViaje);
  const [conceptos] = await pool.execute(
    `SELECT c.id_concepto_presupuesto AS idConceptoPresupuesto,c.id_concepto_origen AS idConceptoOrigen,c.categoria,c.descripcion,c.importe,c.moneda,c.modalidad,c.cantidad,c.estado,c.incluido,c.aplica_todos AS aplicaTodos,c.es_ajuste AS esAjuste,GROUP_CONCAT(DISTINCT a.id_participante) AS participanteIds,(SELECT COUNT(*) FROM cuotas q WHERE q.id_concepto_presupuesto=c.id_concepto_presupuesto) AS cantidadCuotas,COALESCE((SELECT SUM(ap.importe) FROM aplicaciones_pago ap JOIN pagos p1 ON p1.id_pago=ap.id_pago AND p1.estado='ACTIVO' WHERE ap.id_concepto_presupuesto=c.id_concepto_presupuesto),0)+COALESCE((SELECT SUM(ap2.importe) FROM aplicaciones_pago ap2 JOIN pagos p2 ON p2.id_pago=ap2.id_pago AND p2.estado='ACTIVO' JOIN cuotas q2 ON q2.id_cuota=ap2.id_cuota WHERE q2.id_concepto_presupuesto=c.id_concepto_presupuesto),0) AS pagado FROM conceptos_presupuesto c LEFT JOIN asignaciones_presupuesto a ON a.id_concepto_presupuesto=c.id_concepto_presupuesto WHERE c.id_presupuesto=? GROUP BY c.id_concepto_presupuesto ORDER BY c.id_concepto_presupuesto`,
    [p.idPresupuesto],
  );
  p.conceptos = conceptos.map((c) => ({
    ...c,
    participanteIds: c.participanteIds
      ? c.participanteIds.split(",").map(Number)
      : [],
  }));
  const [excursiones] = await pool.execute(
    `SELECT e.id_excursion AS idExcursion,e.puerto,DATE_FORMAT(e.fecha,'%Y-%m-%d') AS fecha,TIME_FORMAT(e.hora,'%H:%i') AS hora,e.proveedor,e.duracion,e.descripcion,e.importe,e.moneda,e.referencia,e.politica_cancelacion AS politicaCancelacion,e.estado,GROUP_CONCAT(pe.id_participante) AS participanteIds FROM excursiones e LEFT JOIN participantes_excursion pe ON pe.id_excursion=e.id_excursion WHERE e.id_presupuesto=? GROUP BY e.id_excursion ORDER BY e.fecha,e.hora`,
    [p.idPresupuesto],
  );
  p.excursiones = excursiones.map((e) => ({
    ...e,
    participanteIds: e.participanteIds
      ? e.participanteIds.split(",").map(Number)
      : [],
  }));
  const [cuotas] = await pool.execute(
    `SELECT c.id_cuota AS idCuota,c.id_concepto_presupuesto AS idConceptoPresupuesto,c.descripcion,c.importe,c.moneda,DATE_FORMAT(c.fecha_vencimiento,'%Y-%m-%d') AS fechaVencimiento,c.estado,COALESCE((SELECT SUM(a.importe) FROM aplicaciones_pago a JOIN pagos p ON p.id_pago=a.id_pago AND p.estado='ACTIVO' WHERE a.id_cuota=c.id_cuota),0) AS pagado,GREATEST(c.importe-COALESCE((SELECT SUM(a.importe) FROM aplicaciones_pago a JOIN pagos p ON p.id_pago=a.id_pago AND p.estado='ACTIVO' WHERE a.id_cuota=c.id_cuota),0),0) AS pendiente FROM cuotas c WHERE c.id_presupuesto=? ORDER BY c.fecha_vencimiento`,
    [p.idPresupuesto],
  );
  p.cuotas = cuotas;
  const [pagos] = await pool.execute(
    `SELECT id_pago AS idPago,DATE_FORMAT(fecha,'%Y-%m-%d') AS fecha,importe,moneda,medio,tipo_cambio AS tipoCambio,observaciones,estado,revertido_en AS revertidoEn,creado_en AS creadoEn FROM pagos WHERE id_presupuesto=? ORDER BY fecha DESC,id_pago DESC`,
    [p.idPresupuesto],
  );
  for (const pago of pagos) {
    const [aportes] = await pool.execute(
      `SELECT a.id_participante AS idParticipante,p.nombre,a.importe FROM aportes_pago a JOIN participantes p ON p.id_participante=a.id_participante WHERE a.id_pago=?`,
      [pago.idPago],
    );
    const [beneficiarios] = await pool.execute(
      `SELECT b.id_participante AS idParticipante,p.nombre,b.importe FROM beneficiarios_pago b JOIN participantes p ON p.id_participante=b.id_participante WHERE b.id_pago=?`,
      [pago.idPago],
    );
    const [aplicaciones] = await pool.execute(
      `SELECT a.id_aplicacion AS idAplicacion,a.id_cuota AS idCuota,a.id_concepto_presupuesto AS idConceptoPresupuesto,a.importe,COALESCE(cu.descripcion,cp.descripcion) AS destino FROM aplicaciones_pago a LEFT JOIN cuotas cu ON cu.id_cuota=a.id_cuota LEFT JOIN conceptos_presupuesto cp ON cp.id_concepto_presupuesto=a.id_concepto_presupuesto WHERE a.id_pago=?`,
      [pago.idPago],
    );
    pago.aportes = aportes;
    pago.beneficiarios = beneficiarios;
    pago.aplicaciones = aplicaciones;
  }
  p.pagos = pagos;
  return p;
}

async function recalcularCuotas(connection, idPresupuesto) {
  await connection.execute(
    `UPDATE cuotas c SET estado=CASE WHEN c.estado='CANCELADA' THEN 'CANCELADA' WHEN COALESCE((SELECT SUM(a.importe) FROM aplicaciones_pago a JOIN pagos p ON p.id_pago=a.id_pago AND p.estado='ACTIVO' WHERE a.id_cuota=c.id_cuota),0)>=c.importe THEN 'PAGADA' WHEN c.fecha_vencimiento<CURDATE() THEN 'VENCIDA' ELSE 'PENDIENTE' END WHERE c.id_presupuesto=?`,
    [idPresupuesto],
  );
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    await acceso(req);
    res.json(await detalle(req.params.idViaje));
  }),
);

router.post(
  "/confirmar",
  validar(z.object({ idCotizacion: z.coerce.number().int().positive() })),
  asyncHandler(async (req, res) => {
    await acceso(req);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [quotes] = await connection.execute(
        "SELECT id_cotizacion,agencia FROM cotizaciones WHERE id_cotizacion=? AND id_viaje=? FOR UPDATE",
        [req.body.idCotizacion, req.params.idViaje],
      );
      if (!quotes[0]) throw new AppError(404, "Cotización no encontrada.");
      const [versions] = await connection.execute(
        "SELECT COALESCE(MAX(version),0)+1 AS version FROM presupuestos WHERE id_viaje=?",
        [req.params.idViaje],
      );
      await connection.execute(
        "UPDATE presupuestos SET activo=FALSE WHERE id_viaje=?",
        [req.params.idViaje],
      );
      const [result] = await connection.execute(
        "INSERT INTO presupuestos (id_viaje,id_cotizacion_origen,version,nombre) VALUES (?,?,?,?)",
        [
          req.params.idViaje,
          req.body.idCotizacion,
          versions[0].version,
          `Presupuesto ${quotes[0].agencia}`,
        ],
      );
      const [conceptos] = await connection.execute(
        "SELECT * FROM conceptos_cotizacion WHERE id_cotizacion=? AND (obligatorio=TRUE OR opcional_seleccionado=TRUE)",
        [req.body.idCotizacion],
      );
      for (const c of conceptos) {
        const [nuevo] = await connection.execute(
          `INSERT INTO conceptos_presupuesto (id_presupuesto,id_concepto_origen,categoria,descripcion,importe,moneda,modalidad,cantidad,estado,incluido,aplica_todos) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [
            result.insertId,
            c.id_concepto,
            c.categoria,
            c.descripcion,
            c.importe,
            c.moneda,
            c.modalidad,
            c.cantidad,
            "CONFIRMADO",
            c.incluido,
            c.aplica_todos,
          ],
        );
        await connection.execute(
          `INSERT INTO asignaciones_presupuesto (id_concepto_presupuesto,id_participante) SELECT ?,id_participante FROM asignaciones_concepto WHERE id_concepto=?`,
          [nuevo.insertId, c.id_concepto],
        );
      }
      await connection.execute(
        "UPDATE cotizaciones SET estado=CASE WHEN id_cotizacion=? THEN 'SELECCIONADA' WHEN estado='SELECCIONADA' THEN 'COMPLETA' ELSE estado END WHERE id_viaje=?",
        [req.body.idCotizacion, req.params.idViaje],
      );
      await connection.commit();
      res.status(201).json(await detalle(req.params.idViaje));
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }),
);

router.post(
  "/conceptos",
  validar(conceptoSchema),
  asyncHandler(async (req, res) => {
    await acceso(req);
    const p = await presupuestoActivo(req.params.idViaje),
      d = req.body,
      connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [r] = await connection.execute(
        `INSERT INTO conceptos_presupuesto (id_presupuesto,categoria,descripcion,importe,moneda,modalidad,cantidad,estado,aplica_todos,es_ajuste) VALUES (?,?,?,?,?,?,?,?,?,TRUE)`,
        [
          p.idPresupuesto,
          d.categoria,
          d.descripcion,
          d.importe,
          d.moneda,
          d.modalidad,
          d.cantidad,
          d.estado,
          d.aplicaTodos,
        ],
      );
      if (!d.aplicaTodos)
        for (const id of d.participanteIds)
          await connection.execute(
            `INSERT INTO asignaciones_presupuesto SELECT ?,id_participante FROM participantes WHERE id_participante=? AND id_viaje=? AND activo=TRUE`,
            [r.insertId, id, req.params.idViaje],
          );
      await connection.commit();
      res.status(201).json(await detalle(req.params.idViaje));
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }),
);

router.put(
  "/conceptos/:idConceptoPresupuesto",
  validar(conceptoSchema),
  asyncHandler(async (req, res) => {
    await acceso(req);
    const p = await presupuestoActivo(req.params.idViaje),
      d = req.body,
      connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [actuales] = await connection.execute(
        `SELECT c.moneda,COALESCE(SUM(CASE WHEN pg.estado='ACTIVO' THEN ap.importe ELSE 0 END),0) AS pagado FROM conceptos_presupuesto c LEFT JOIN aplicaciones_pago ap ON ap.id_concepto_presupuesto=c.id_concepto_presupuesto LEFT JOIN pagos pg ON pg.id_pago=ap.id_pago WHERE c.id_concepto_presupuesto=? AND c.id_presupuesto=? GROUP BY c.id_concepto_presupuesto FOR UPDATE`,
        [req.params.idConceptoPresupuesto, p.idPresupuesto],
      );
      if (!actuales[0]) throw new AppError(404, "Concepto no encontrado.");
      if (Number(actuales[0].pagado) > 0 && actuales[0].moneda !== d.moneda)
        throw new AppError(
          409,
          "No se puede cambiar la moneda de un concepto con pagos.",
        );
      await connection.execute(
        `UPDATE conceptos_presupuesto SET categoria=?,descripcion=?,importe=?,moneda=?,modalidad=?,cantidad=?,estado=?,aplica_todos=? WHERE id_concepto_presupuesto=? AND id_presupuesto=?`,
        [
          d.categoria,
          d.descripcion,
          d.importe,
          d.moneda,
          d.modalidad,
          d.cantidad,
          d.estado,
          d.aplicaTodos,
          req.params.idConceptoPresupuesto,
          p.idPresupuesto,
        ],
      );
      await connection.execute(
        "DELETE FROM asignaciones_presupuesto WHERE id_concepto_presupuesto=?",
        [req.params.idConceptoPresupuesto],
      );
      if (!d.aplicaTodos)
        for (const id of d.participanteIds)
          await connection.execute(
            `INSERT INTO asignaciones_presupuesto SELECT ?,id_participante FROM participantes WHERE id_participante=? AND id_viaje=? AND activo=TRUE`,
            [req.params.idConceptoPresupuesto, id, req.params.idViaje],
          );
      await connection.commit();
      res.json(await detalle(req.params.idViaje));
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }),
);

router.post(
  "/excursiones",
  validar(excursionSchema),
  asyncHandler(async (req, res) => {
    await acceso(req);
    const p = await presupuestoActivo(req.params.idViaje),
      d = req.body,
      connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [r] = await connection.execute(
        `INSERT INTO excursiones (id_presupuesto,puerto,fecha,hora,proveedor,duracion,descripcion,importe,moneda,referencia,politica_cancelacion,estado) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          p.idPresupuesto,
          d.puerto,
          d.fecha ?? null,
          d.hora ?? null,
          d.proveedor ?? null,
          d.duracion ?? null,
          d.descripcion,
          d.importe,
          d.moneda,
          d.referencia ?? null,
          d.politicaCancelacion ?? null,
          d.estado,
        ],
      );
      for (const id of d.participanteIds)
        await connection.execute(
          `INSERT INTO participantes_excursion SELECT ?,id_participante FROM participantes WHERE id_participante=? AND id_viaje=? AND activo=TRUE`,
          [r.insertId, id, req.params.idViaje],
        );
      await connection.commit();
      res.status(201).json(await detalle(req.params.idViaje));
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }),
);
router.put(
  "/excursiones/:idExcursion",
  validar(excursionSchema),
  asyncHandler(async (req, res) => {
    await acceso(req);
    const p = await presupuestoActivo(req.params.idViaje),
      d = req.body,
      connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [r] = await connection.execute(
        `UPDATE excursiones SET puerto=?,fecha=?,hora=?,proveedor=?,duracion=?,descripcion=?,importe=?,moneda=?,referencia=?,politica_cancelacion=?,estado=? WHERE id_excursion=? AND id_presupuesto=?`,
        [
          d.puerto,
          d.fecha ?? null,
          d.hora ?? null,
          d.proveedor ?? null,
          d.duracion ?? null,
          d.descripcion,
          d.importe,
          d.moneda,
          d.referencia ?? null,
          d.politicaCancelacion ?? null,
          d.estado,
          req.params.idExcursion,
          p.idPresupuesto,
        ],
      );
      if (!r.affectedRows) throw new AppError(404, "Excursión no encontrada.");
      await connection.execute(
        "DELETE FROM participantes_excursion WHERE id_excursion=?",
        [req.params.idExcursion],
      );
      for (const id of d.participanteIds)
        await connection.execute(
          `INSERT INTO participantes_excursion SELECT ?,id_participante FROM participantes WHERE id_participante=? AND id_viaje=? AND activo=TRUE`,
          [req.params.idExcursion, id, req.params.idViaje],
        );
      await connection.commit();
      res.json(await detalle(req.params.idViaje));
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }),
);
router.delete(
  "/excursiones/:idExcursion",
  asyncHandler(async (req, res) => {
    await acceso(req);
    const p = await presupuestoActivo(req.params.idViaje);
    const [r] = await pool.execute(
      "DELETE FROM excursiones WHERE id_excursion=? AND id_presupuesto=?",
      [req.params.idExcursion, p.idPresupuesto],
    );
    if (!r.affectedRows) throw new AppError(404, "Excursión no encontrada.");
    res.status(204).end();
  }),
);

router.post(
  "/cuotas",
  validar(cuotaSchema),
  asyncHandler(async (req, res) => {
    await acceso(req);
    const p = await presupuestoActivo(req.params.idViaje),
      d = req.body;
    const [r] = await pool.execute(
      `INSERT INTO cuotas (id_presupuesto,id_concepto_presupuesto,descripcion,importe,moneda,fecha_vencimiento,estado) VALUES (?,?,?,?,?,?,?)`,
      [
        p.idPresupuesto,
        d.idConceptoPresupuesto ?? null,
        d.descripcion,
        d.importe,
        d.moneda,
        d.fechaVencimiento,
        d.estado,
      ],
    );
    res.status(201).json({ idCuota: Number(r.insertId), ...d });
  }),
);
router.put(
  "/cuotas/:idCuota",
  validar(cuotaSchema),
  asyncHandler(async (req, res) => {
    await acceso(req);
    const p = await presupuestoActivo(req.params.idViaje),
      d = req.body;
    const [actuales] = await pool.execute(
      `SELECT c.moneda,COALESCE(SUM(CASE WHEN pg.estado='ACTIVO' THEN ap.importe ELSE 0 END),0) AS pagado FROM cuotas c LEFT JOIN aplicaciones_pago ap ON ap.id_cuota=c.id_cuota LEFT JOIN pagos pg ON pg.id_pago=ap.id_pago WHERE c.id_cuota=? AND c.id_presupuesto=? GROUP BY c.id_cuota`,
      [req.params.idCuota, p.idPresupuesto],
    );
    if (!actuales[0]) throw new AppError(404, "Cuota no encontrada.");
    const pagado = Number(actuales[0].pagado);
    if (d.importe + 0.005 < pagado)
      throw new AppError(
        409,
        `El importe no puede ser menor que lo ya pagado (${pagado.toFixed(2)}).`,
      );
    if (pagado > 0 && actuales[0].moneda !== d.moneda)
      throw new AppError(
        409,
        "No se puede cambiar la moneda de una cuota con pagos.",
      );
    await pool.execute(
      `UPDATE cuotas SET id_concepto_presupuesto=?,descripcion=?,importe=?,moneda=?,fecha_vencimiento=?,estado=? WHERE id_cuota=? AND id_presupuesto=?`,
      [
        d.idConceptoPresupuesto ?? null,
        d.descripcion,
        d.importe,
        d.moneda,
        d.fechaVencimiento,
        d.estado,
        req.params.idCuota,
        p.idPresupuesto,
      ],
    );
    res.json(await detalle(req.params.idViaje));
  }),
);
router.patch(
  "/cuotas/:idCuota",
  validar(
    z.object({
      estado: z.enum(["PENDIENTE", "PAGADA", "VENCIDA", "CANCELADA"]),
    }),
  ),
  asyncHandler(async (req, res) => {
    await acceso(req);
    const p = await presupuestoActivo(req.params.idViaje);
    const [r] = await pool.execute(
      "UPDATE cuotas SET estado=? WHERE id_cuota=? AND id_presupuesto=?",
      [req.body.estado, req.params.idCuota, p.idPresupuesto],
    );
    if (!r.affectedRows) throw new AppError(404, "Cuota no encontrada.");
    res.json({ idCuota: Number(req.params.idCuota), estado: req.body.estado });
  }),
);

router.post(
  "/pagos",
  validar(pagoSchema),
  asyncHandler(async (req, res) => {
    await acceso(req);
    const p = await presupuestoActivo(req.params.idViaje),
      d = req.body,
      connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const a of d.aplicaciones) {
        if (a.idCuota) {
          const [rows] = await connection.execute(
            `SELECT c.importe,COALESCE((SELECT SUM(ap.importe) FROM aplicaciones_pago ap JOIN pagos p ON p.id_pago=ap.id_pago AND p.estado='ACTIVO' WHERE ap.id_cuota=c.id_cuota),0) AS pagado FROM cuotas c WHERE c.id_cuota=? AND c.id_presupuesto=? FOR UPDATE`,
            [a.idCuota, p.idPresupuesto],
          );
          if (!rows[0])
            throw new AppError(400, "La cuota no pertenece al presupuesto.");
          if (
            Number(rows[0].pagado) + a.importe >
            Number(rows[0].importe) + 0.005
          )
            throw new AppError(
              400,
              "El pago supera el saldo pendiente de una cuota.",
            );
        } else {
          const [rows] = await connection.execute(
            `SELECT c.id_concepto_presupuesto,(SELECT COUNT(*) FROM cuotas q WHERE q.id_concepto_presupuesto=c.id_concepto_presupuesto) AS cuotas FROM conceptos_presupuesto c WHERE c.id_concepto_presupuesto=? AND c.id_presupuesto=? FOR UPDATE`,
            [a.idConceptoPresupuesto, p.idPresupuesto],
          );
          if (!rows[0])
            throw new AppError(400, "El concepto no pertenece al presupuesto.");
          if (rows[0].cuotas)
            throw new AppError(
              400,
              "Ese concepto tiene cuotas; aplicá el pago a sus cuotas para evitar contabilizarlo dos veces.",
            );
        }
      }
      const [r] = await connection.execute(
        `INSERT INTO pagos (id_presupuesto,fecha,importe,moneda,medio,tipo_cambio,observaciones) VALUES (?,?,?,?,?,?,?)`,
        [
          p.idPresupuesto,
          d.fecha,
          d.importe,
          d.moneda,
          d.medio ?? null,
          d.tipoCambio ?? null,
          d.observaciones ?? null,
        ],
      );
      for (const a of d.aportes) {
        const [x] = await connection.execute(
          `INSERT INTO aportes_pago (id_pago,id_participante,importe) SELECT ?,id_participante,? FROM participantes WHERE id_participante=? AND id_viaje=? AND activo=TRUE`,
          [r.insertId, a.importe, a.idParticipante, req.params.idViaje],
        );
        if (!x.affectedRows)
          throw new AppError(400, "Una pagadora no pertenece al viaje.");
      }
      for (const b of d.beneficiarios) {
        const [x] = await connection.execute(
          `INSERT INTO beneficiarios_pago (id_pago,id_participante,importe) SELECT ?,id_participante,? FROM participantes WHERE id_participante=? AND id_viaje=?`,
          [r.insertId, b.importe, b.idParticipante, req.params.idViaje],
        );
        if (!x.affectedRows)
          throw new AppError(400, "Una beneficiaria no pertenece al viaje.");
      }
      for (const a of d.aplicaciones) {
        if (a.idCuota)
          await connection.execute(
            `INSERT INTO aplicaciones_pago (id_pago,id_cuota,importe) VALUES (?,?,?)`,
            [r.insertId, a.idCuota, a.importe],
          );
        else
          await connection.execute(
            `INSERT INTO aplicaciones_pago (id_pago,id_concepto_presupuesto,importe) VALUES (?,?,?)`,
            [r.insertId, a.idConceptoPresupuesto, a.importe],
          );
      }
      await recalcularCuotas(connection, p.idPresupuesto);
      await connection.commit();
      res.status(201).json(await detalle(req.params.idViaje));
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }),
);

router.delete(
  "/pagos/:idPago",
  asyncHandler(async (req, res) => {
    await acceso(req);
    const p = await presupuestoActivo(req.params.idViaje),
      connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [r] = await connection.execute(
        "UPDATE pagos SET estado='REVERTIDO',revertido_en=CURRENT_TIMESTAMP WHERE id_pago=? AND id_presupuesto=? AND estado='ACTIVO'",
        [req.params.idPago, p.idPresupuesto],
      );
      if (!r.affectedRows) throw new AppError(404, "Pago no encontrado.");
      await recalcularCuotas(connection, p.idPresupuesto);
      await connection.commit();
      res.status(204).end();
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }),
);

export default router;
