import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { AppError, asyncHandler } from '../errors.js';
import { validar } from '../validation.js';
import { obtenerViaje } from './viajes.routes.js';

const router = Router({ mergeParams: true });
const participante = z.object({
  nombre: z.string().trim().min(2).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional()
});

async function comprobarAcceso(req) {
  return obtenerViaje(req.params.idViaje, req.usuario.idUsuario);
}

router.get('/', asyncHandler(async (req, res) => {
  await comprobarAcceso(req);
  const [rows] = await pool.execute(
    `SELECT id_participante AS idParticipante, nombre, color, activo, creado_en AS creadoEn
     FROM participantes WHERE id_viaje = ? ORDER BY activo DESC, nombre`,
    [req.params.idViaje]
  );
  res.json(rows);
}));

router.post('/', validar(participante), asyncHandler(async (req, res) => {
  await comprobarAcceso(req);
  const [result] = await pool.execute(
    'INSERT INTO participantes (id_viaje, nombre, color) VALUES (?, ?, ?)',
    [req.params.idViaje, req.body.nombre, req.body.color ?? null]
  );
  res.status(201).json({ idParticipante: Number(result.insertId), ...req.body, activo: true });
}));

router.put('/:idParticipante', validar(participante), asyncHandler(async (req, res) => {
  await comprobarAcceso(req);
  const [result] = await pool.execute(
    'UPDATE participantes SET nombre = ?, color = ? WHERE id_participante = ? AND id_viaje = ?',
    [req.body.nombre, req.body.color ?? null, req.params.idParticipante, req.params.idViaje]
  );
  if (!result.affectedRows) throw new AppError(404, 'Participante no encontrado.');
  res.json({ idParticipante: Number(req.params.idParticipante), ...req.body });
}));

router.delete('/:idParticipante', asyncHandler(async (req, res) => {
  await comprobarAcceso(req);
  const [result] = await pool.execute(
    'DELETE FROM participantes WHERE id_participante = ? AND id_viaje = ?',
    [req.params.idParticipante, req.params.idViaje]
  );
  if (!result.affectedRows) throw new AppError(404, 'Participante no encontrado.');
  res.status(204).end();
}));

router.patch('/:idParticipante/desactivar', asyncHandler(async (req, res) => {
  await comprobarAcceso(req);
  const [result] = await pool.execute(
    'UPDATE participantes SET activo = FALSE WHERE id_participante = ? AND id_viaje = ? AND activo = TRUE',
    [req.params.idParticipante, req.params.idViaje]
  );
  if (!result.affectedRows) throw new AppError(404, 'Participante activo no encontrado.');
  res.json({ idParticipante: Number(req.params.idParticipante), activo: false });
}));

router.patch('/:idParticipante/reactivar', asyncHandler(async (req, res) => {
  await comprobarAcceso(req);
  const [result] = await pool.execute(
    'UPDATE participantes SET activo = TRUE WHERE id_participante = ? AND id_viaje = ? AND activo = FALSE',
    [req.params.idParticipante, req.params.idViaje]
  );
  if (!result.affectedRows) throw new AppError(404, 'Participante inactivo no encontrado.');
  res.json({ idParticipante: Number(req.params.idParticipante), activo: true });
}));

export default router;
