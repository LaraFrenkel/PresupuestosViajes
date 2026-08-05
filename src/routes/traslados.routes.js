import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { AppError, asyncHandler } from "../errors.js";
import { validar } from "../validation.js";
import { obtenerViaje } from "./viajes.routes.js";

const router = Router({ mergeParams: true });
const tipos = [
  "AVION",
  "AUTO",
  "TREN",
  "MICRO",
  "BARCO",
  "FERRY",
  "TRANSPORTE_PUBLICO",
  "OTRO",
];
const fechaHora = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  .nullable()
  .optional();
const traslado = z
  .object({
    tipo: z.enum(tipos),
    origen: z.string().trim().min(2).max(150),
    destino: z.string().trim().min(2).max(150),
    fechaSalida: fechaHora,
    fechaLlegada: fechaHora,
    proveedor: z.string().trim().max(120).nullable().optional(),
    referencia: z.string().trim().max(100).nullable().optional(),
    moneda: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable()
      .optional(),
    importe: z.coerce.number().min(0).nullable().optional(),
    notas: z.string().trim().max(2000).nullable().optional(),
    orden: z.coerce.number().int().min(0).max(999).default(0),
  })
  .refine(
    (data) =>
      !data.fechaSalida ||
      !data.fechaLlegada ||
      new Date(data.fechaLlegada) >= new Date(data.fechaSalida),
    { message: "La llegada no puede ser anterior a la salida." },
  );

router.get(
  "/",
  asyncHandler(async (req, res) => {
    await obtenerViaje(req.params.idViaje, req.usuario.idUsuario);
    const [rows] = await pool.execute(
      `SELECT id_traslado AS idTraslado,tipo,origen,destino,
       DATE_FORMAT(fecha_salida,'%Y-%m-%dT%H:%i') AS fechaSalida,
       DATE_FORMAT(fecha_llegada,'%Y-%m-%dT%H:%i') AS fechaLlegada,
       proveedor,referencia,moneda,importe,notas,orden
       FROM traslados WHERE id_viaje=? ORDER BY orden,fecha_salida,id_traslado`,
      [req.params.idViaje],
    );
    res.json(rows);
  }),
);

router.post(
  "/",
  validar(traslado),
  asyncHandler(async (req, res) => {
    await obtenerViaje(req.params.idViaje, req.usuario.idUsuario);
    const d = req.body;
    const [result] = await pool.execute(
      `INSERT INTO traslados
       (id_viaje,tipo,origen,destino,fecha_salida,fecha_llegada,proveedor,
        referencia,moneda,importe,notas,orden)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.params.idViaje,
        d.tipo,
        d.origen,
        d.destino,
        d.fechaSalida || null,
        d.fechaLlegada || null,
        d.proveedor || null,
        d.referencia || null,
        d.moneda || null,
        d.importe ?? null,
        d.notas || null,
        d.orden,
      ],
    );
    res.status(201).json({ idTraslado: Number(result.insertId) });
  }),
);

router.put(
  "/:idTraslado",
  validar(traslado),
  asyncHandler(async (req, res) => {
    await obtenerViaje(req.params.idViaje, req.usuario.idUsuario);
    const d = req.body;
    const [result] = await pool.execute(
      `UPDATE traslados SET tipo=?,origen=?,destino=?,fecha_salida=?,
       fecha_llegada=?,proveedor=?,referencia=?,moneda=?,importe=?,notas=?,orden=?
       WHERE id_traslado=? AND id_viaje=?`,
      [
        d.tipo,
        d.origen,
        d.destino,
        d.fechaSalida || null,
        d.fechaLlegada || null,
        d.proveedor || null,
        d.referencia || null,
        d.moneda || null,
        d.importe ?? null,
        d.notas || null,
        d.orden,
        req.params.idTraslado,
        req.params.idViaje,
      ],
    );
    if (!result.affectedRows)
      throw new AppError(404, "Traslado no encontrado.");
    res.json({ actualizado: true });
  }),
);

router.delete(
  "/:idTraslado",
  asyncHandler(async (req, res) => {
    await obtenerViaje(req.params.idViaje, req.usuario.idUsuario);
    const [result] = await pool.execute(
      "DELETE FROM traslados WHERE id_traslado=? AND id_viaje=?",
      [req.params.idTraslado, req.params.idViaje],
    );
    if (!result.affectedRows)
      throw new AppError(404, "Traslado no encontrado.");
    res.status(204).end();
  }),
);

export default router;
