import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { AppError, asyncHandler } from "../errors.js";
import { validar } from "../validation.js";

const router = Router();

router.get(
  "/usuarios",
  asyncHandler(async (_req, res) => {
    const [usuarios] = await pool.execute(
      `SELECT u.id_usuario AS idUsuario,u.nombre,u.email,u.rol,u.activo,
       u.creado_en AS creadoEn,u.ultimo_acceso AS ultimoAcceso,
       u.bloqueado_en AS bloqueadoEn,u.motivo_bloqueo AS motivoBloqueo,
       (SELECT COUNT(*) FROM viajes v WHERE v.id_usuario=u.id_usuario) AS cantidadViajes,
       (SELECT COUNT(*) FROM colaboradores_viaje cv WHERE cv.id_usuario=u.id_usuario) AS cantidadColaboraciones
       FROM usuarios u ORDER BY u.creado_en DESC`,
    );
    res.json(usuarios);
  }),
);

router.get(
  "/acciones",
  asyncHandler(async (_req, res) => {
    const [acciones] = await pool.execute(
      `SELECT a.id_accion AS idAccion,a.accion,a.motivo,a.creado_en AS creadoEn,
       admin.nombre AS adminNombre,afectado.nombre AS usuarioNombre,
       afectado.email AS usuarioEmail
       FROM acciones_admin a
       LEFT JOIN usuarios admin ON admin.id_usuario=a.id_admin
       LEFT JOIN usuarios afectado ON afectado.id_usuario=a.id_usuario
       ORDER BY a.creado_en DESC LIMIT 100`,
    );
    res.json(acciones);
  }),
);

router.patch(
  "/usuarios/:idUsuario/acceso",
  validar(
    z.object({
      accion: z.enum(["BLOQUEAR", "RESTAURAR"]),
      motivo: z.string().trim().min(5).max(300),
    }),
  ),
  asyncHandler(async (req, res) => {
    const idUsuario = Number(req.params.idUsuario);
    if (idUsuario === req.usuario.idUsuario) {
      throw new AppError(
        409,
        "No podés modificar el acceso de tu propia cuenta.",
      );
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [usuarios] = await connection.execute(
        "SELECT id_usuario FROM usuarios WHERE id_usuario=? FOR UPDATE",
        [idUsuario],
      );
      if (!usuarios[0]) throw new AppError(404, "Usuario no encontrado.");
      const bloquear = req.body.accion === "BLOQUEAR";
      await connection.execute(
        `UPDATE usuarios SET activo=?,bloqueado_en=?,motivo_bloqueo=?
         WHERE id_usuario=?`,
        [
          bloquear ? 0 : 1,
          bloquear ? new Date() : null,
          bloquear ? req.body.motivo : null,
          idUsuario,
        ],
      );
      await connection.execute(
        `INSERT INTO acciones_admin (id_admin,id_usuario,accion,motivo)
         VALUES (?,?,?,?)`,
        [req.usuario.idUsuario, idUsuario, req.body.accion, req.body.motivo],
      );
      await connection.commit();
      res.json({
        idUsuario,
        activo: !bloquear,
        motivoBloqueo: bloquear ? req.body.motivo : null,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }),
);

export default router;
