import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { AppError, asyncHandler } from "../errors.js";
import { validar } from "../validation.js";

const router = Router();
const estados = [
  "PLANIFICACION",
  "CONFIRMADO",
  "EN_CURSO",
  "FINALIZADO",
  "ARCHIVADO",
];
const fecha = /^\d{4}-\d{2}-\d{2}$/;
const viaje = z
  .object({
    nombre: z.string().trim().min(2).max(150),
    tipoViaje: z.string().trim().min(2).max(50).default("CRUCERO"),
    naviera: z.string().trim().max(100).nullable().optional(),
    barco: z.string().trim().max(100).nullable().optional(),
    puertoSalida: z.string().trim().max(120).nullable().optional(),
    fechaSalida: z.string().regex(fecha, "Debe usar AAAA-MM-DD."),
    fechaRegreso: z.string().regex(fecha, "Debe usar AAAA-MM-DD."),
    monedaPrincipal: z.string().regex(/^[A-Z]{3}$/),
    estado: z.enum(estados).default("PLANIFICACION"),
    itinerario: z.string().trim().nullable().optional(),
  })
  .refine((data) => data.fechaRegreso >= data.fechaSalida, {
    message: "La fecha de regreso no puede ser anterior a la salida.",
    path: ["fechaRegreso"],
  });

export async function obtenerViaje(idViaje, idUsuario) {
  const [rows] = await pool.execute(
    `SELECT id_viaje AS idViaje, nombre, tipo_viaje AS tipoViaje, naviera, barco,
      puerto_salida AS puertoSalida, DATE_FORMAT(fecha_salida, '%Y-%m-%d') AS fechaSalida,
      DATE_FORMAT(fecha_regreso, '%Y-%m-%d') AS fechaRegreso,
      moneda_principal AS monedaPrincipal, estado, itinerario
     FROM viajes WHERE id_viaje = ? AND id_usuario = ?`,
    [idViaje, idUsuario],
  );
  if (!rows[0]) throw new AppError(404, "Viaje no encontrado.");
  return rows[0];
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT v.id_viaje AS idViaje, v.nombre, v.tipo_viaje AS tipoViaje,
      DATE_FORMAT(v.fecha_salida, '%Y-%m-%d') AS fechaSalida,
      DATE_FORMAT(v.fecha_regreso, '%Y-%m-%d') AS fechaRegreso,
      v.moneda_principal AS monedaPrincipal, v.estado,
      COUNT(p.id_participante) AS cantidadParticipantes
     FROM viajes v LEFT JOIN participantes p ON p.id_viaje = v.id_viaje AND p.activo = TRUE
     WHERE v.id_usuario = ? GROUP BY v.id_viaje ORDER BY v.fecha_salida`,
      [req.usuario.idUsuario],
    );
    res.json(rows);
  }),
);

router.post(
  "/",
  validar(viaje),
  asyncHandler(async (req, res) => {
    const d = req.body;
    const [result] = await pool.execute(
      `INSERT INTO viajes
      (id_usuario, nombre, tipo_viaje, naviera, barco, puerto_salida, fecha_salida, fecha_regreso, moneda_principal, estado, itinerario)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.usuario.idUsuario,
        d.nombre,
        d.tipoViaje,
        d.naviera ?? null,
        d.barco ?? null,
        d.puertoSalida ?? null,
        d.fechaSalida,
        d.fechaRegreso,
        d.monedaPrincipal,
        d.estado,
        d.itinerario ?? null,
      ],
    );
    res
      .status(201)
      .json(await obtenerViaje(result.insertId, req.usuario.idUsuario));
  }),
);

router.get(
  "/:idViaje",
  asyncHandler(async (req, res) => {
    res.json(await obtenerViaje(req.params.idViaje, req.usuario.idUsuario));
  }),
);

router.put(
  "/:idViaje",
  validar(viaje),
  asyncHandler(async (req, res) => {
    await obtenerViaje(req.params.idViaje, req.usuario.idUsuario);
    const d = req.body;
    await pool.execute(
      `UPDATE viajes SET nombre=?, tipo_viaje=?, naviera=?, barco=?, puerto_salida=?,
      fecha_salida=?, fecha_regreso=?, moneda_principal=?, estado=?, itinerario=?
     WHERE id_viaje=? AND id_usuario=?`,
      [
        d.nombre,
        d.tipoViaje,
        d.naviera ?? null,
        d.barco ?? null,
        d.puertoSalida ?? null,
        d.fechaSalida,
        d.fechaRegreso,
        d.monedaPrincipal,
        d.estado,
        d.itinerario ?? null,
        req.params.idViaje,
        req.usuario.idUsuario,
      ],
    );
    res.json(await obtenerViaje(req.params.idViaje, req.usuario.idUsuario));
  }),
);

router.delete(
  "/:idViaje",
  asyncHandler(async (req, res) => {
    await obtenerViaje(req.params.idViaje, req.usuario.idUsuario);
    await pool.execute(
      `UPDATE viajes
     SET estado = CASE WHEN estado = 'ARCHIVADO' THEN 'PLANIFICACION' ELSE 'ARCHIVADO' END
     WHERE id_viaje = ? AND id_usuario = ?`,
      [req.params.idViaje, req.usuario.idUsuario],
    );
    res.json(await obtenerViaje(req.params.idViaje, req.usuario.idUsuario));
  }),
);

router.delete(
  "/:idViaje/permanente",
  asyncHandler(async (req, res) => {
    const actual = await obtenerViaje(
      req.params.idViaje,
      req.usuario.idUsuario,
    );
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const id = req.params.idViaje;
      await connection.execute(
        `DELETE ac FROM asignaciones_concepto ac JOIN conceptos_cotizacion cc ON cc.id_concepto=ac.id_concepto JOIN cotizaciones c ON c.id_cotizacion=cc.id_cotizacion WHERE c.id_viaje=?`,
        [id],
      );
      await connection.execute(
        `DELETE ap FROM asignaciones_presupuesto ap JOIN conceptos_presupuesto cp ON cp.id_concepto_presupuesto=ap.id_concepto_presupuesto JOIN presupuestos p ON p.id_presupuesto=cp.id_presupuesto WHERE p.id_viaje=?`,
        [id],
      );
      await connection.execute(
        `DELETE pe FROM participantes_excursion pe JOIN excursiones e ON e.id_excursion=pe.id_excursion JOIN presupuestos p ON p.id_presupuesto=e.id_presupuesto WHERE p.id_viaje=?`,
        [id],
      );
      await connection.execute(
        `DELETE ap FROM aplicaciones_pago ap JOIN pagos pg ON pg.id_pago=ap.id_pago JOIN presupuestos p ON p.id_presupuesto=pg.id_presupuesto WHERE p.id_viaje=?`,
        [id],
      );
      await connection.execute(
        `DELETE a FROM aportes_pago a JOIN pagos pg ON pg.id_pago=a.id_pago JOIN presupuestos p ON p.id_presupuesto=pg.id_presupuesto WHERE p.id_viaje=?`,
        [id],
      );
      await connection.execute(
        `DELETE b FROM beneficiarios_pago b JOIN pagos pg ON pg.id_pago=b.id_pago JOIN presupuestos p ON p.id_presupuesto=pg.id_presupuesto WHERE p.id_viaje=?`,
        [id],
      );
      await connection.execute(
        `DELETE pg FROM pagadores_gasto pg JOIN gastos g ON g.id_gasto=pg.id_gasto WHERE g.id_viaje=?`,
        [id],
      );
      await connection.execute(
        `DELETE ag FROM asignaciones_gasto ag JOIN gastos g ON g.id_gasto=ag.id_gasto WHERE g.id_viaje=?`,
        [id],
      );
      await connection.execute("DELETE FROM transferencias WHERE id_viaje=?", [
        id,
      ]);
      const [result] = await connection.execute(
        "DELETE FROM viajes WHERE id_viaje = ? AND id_usuario = ?",
        [id, req.usuario.idUsuario],
      );
      if (!result.affectedRows) throw new AppError(404, "Viaje no encontrado.");
      await connection.commit();
      res.json({ eliminado: true, idViaje: Number(id), nombre: actual.nombre });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }),
);

export default router;
