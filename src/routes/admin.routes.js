import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { AppError, asyncHandler } from "../errors.js";
import { validar } from "../validation.js";

const router = Router();

async function obtenerVistaLimpieza(
  connection,
  idConservado,
  bloquear = false,
) {
  const [cuentas] = await connection.execute(
    `SELECT id_usuario AS idUsuario FROM usuarios WHERE id_usuario<>?${bloquear ? " FOR UPDATE" : ""}`,
    [idConservado],
  );
  const ids = cuentas.map((cuenta) => cuenta.idUsuario);
  let cantidadViajes = 0;
  if (ids.length) {
    const [viajes] = await connection.query(
      "SELECT COUNT(*) AS cantidad FROM viajes WHERE id_usuario IN (?)",
      [ids],
    );
    cantidadViajes = Number(viajes[0].cantidad);
  }
  const [historial] = await connection.execute(
    "SELECT COUNT(*) AS cantidad FROM acciones_admin",
  );
  return {
    ids,
    cantidadUsuarios: ids.length,
    cantidadViajes,
    cantidadHistorial: Number(historial[0].cantidad),
  };
}

async function eliminarDatosDeUsuarios(connection, idsUsuarios) {
  if (!idsUsuarios.length) return;
  const [viajes] = await connection.query(
    "SELECT id_viaje AS idViaje FROM viajes WHERE id_usuario IN (?)",
    [idsUsuarios],
  );
  for (const viaje of viajes) {
    const id = viaje.idViaje;
    await connection.execute(
      `DELETE ac FROM asignaciones_concepto ac
       JOIN conceptos_cotizacion cc ON cc.id_concepto=ac.id_concepto
       JOIN cotizaciones c ON c.id_cotizacion=cc.id_cotizacion
       WHERE c.id_viaje=?`,
      [id],
    );
    await connection.execute(
      `DELETE ap FROM asignaciones_presupuesto ap
       JOIN conceptos_presupuesto cp ON cp.id_concepto_presupuesto=ap.id_concepto_presupuesto
       JOIN presupuestos p ON p.id_presupuesto=cp.id_presupuesto
       WHERE p.id_viaje=?`,
      [id],
    );
    await connection.execute(
      `DELETE pe FROM participantes_excursion pe
       JOIN excursiones e ON e.id_excursion=pe.id_excursion
       JOIN presupuestos p ON p.id_presupuesto=e.id_presupuesto
       WHERE p.id_viaje=?`,
      [id],
    );
    await connection.execute(
      `DELETE ap FROM aplicaciones_pago ap
       JOIN pagos pg ON pg.id_pago=ap.id_pago
       JOIN presupuestos p ON p.id_presupuesto=pg.id_presupuesto
       WHERE p.id_viaje=?`,
      [id],
    );
    await connection.execute(
      `DELETE a FROM aportes_pago a
       JOIN pagos pg ON pg.id_pago=a.id_pago
       JOIN presupuestos p ON p.id_presupuesto=pg.id_presupuesto
       WHERE p.id_viaje=?`,
      [id],
    );
    await connection.execute(
      `DELETE b FROM beneficiarios_pago b
       JOIN pagos pg ON pg.id_pago=b.id_pago
       JOIN presupuestos p ON p.id_presupuesto=pg.id_presupuesto
       WHERE p.id_viaje=?`,
      [id],
    );
    await connection.execute(
      `DELETE pg FROM pagadores_gasto pg
       JOIN gastos g ON g.id_gasto=pg.id_gasto WHERE g.id_viaje=?`,
      [id],
    );
    await connection.execute(
      `DELETE ag FROM asignaciones_gasto ag
       JOIN gastos g ON g.id_gasto=ag.id_gasto WHERE g.id_viaje=?`,
      [id],
    );
    await connection.execute("DELETE FROM transferencias WHERE id_viaje=?", [
      id,
    ]);
  }
  await connection.query(
    "UPDATE acciones_admin SET id_admin=NULL WHERE id_admin IN (?)",
    [idsUsuarios],
  );
  await connection.query(
    "UPDATE acciones_admin SET id_usuario=NULL WHERE id_usuario IN (?)",
    [idsUsuarios],
  );
  await connection.query(
    "UPDATE sincronizacion_viaje SET id_usuario_ultimo=NULL WHERE id_usuario_ultimo IN (?)",
    [idsUsuarios],
  );
  await connection.query(
    "UPDATE cambios_sincronizacion SET id_usuario=NULL WHERE id_usuario IN (?)",
    [idsUsuarios],
  );
  await connection.query(
    "DELETE FROM colaboradores_viaje WHERE id_usuario IN (?)",
    [idsUsuarios],
  );
  await connection.query("DELETE FROM viajes WHERE id_usuario IN (?)", [
    idsUsuarios,
  ]);
}

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
       admin.nombre AS adminNombre,
       COALESCE(afectado.nombre,a.usuario_nombre) AS usuarioNombre,
       COALESCE(afectado.email,a.usuario_email) AS usuarioEmail
       FROM acciones_admin a
       LEFT JOIN usuarios admin ON admin.id_usuario=a.id_admin
       LEFT JOIN usuarios afectado ON afectado.id_usuario=a.id_usuario
       ORDER BY a.creado_en DESC LIMIT 100`,
    );
    res.json(acciones);
  }),
);

router.get(
  "/seguridad",
  asyncHandler(async (_req, res) => {
    const [eventos] = await pool.execute(
      `SELECT e.id_evento AS idEvento,e.tipo,e.email_intentado AS email,
       e.ip,e.detalle,e.creado_en AS creadoEn,u.nombre AS usuarioNombre
       FROM eventos_seguridad e
       LEFT JOIN usuarios u ON u.id_usuario=e.id_usuario
       ORDER BY e.creado_en DESC LIMIT 100`,
    );
    res.json(eventos);
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
        `INSERT INTO acciones_admin
         (id_admin,id_usuario,accion,motivo,usuario_nombre,usuario_email)
         SELECT ?,id_usuario,?,?,nombre,email FROM usuarios WHERE id_usuario=?`,
        [req.usuario.idUsuario, req.body.accion, req.body.motivo, idUsuario],
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

router.delete(
  "/usuarios/:idUsuario",
  validar(
    z.object({
      emailConfirmacion: z
        .email()
        .max(150)
        .transform((email) => email.toLowerCase()),
      motivo: z.string().trim().min(5).max(300),
    }),
  ),
  asyncHandler(async (req, res) => {
    const idUsuario = Number(req.params.idUsuario);
    if (idUsuario === req.usuario.idUsuario) {
      throw new AppError(409, "No podés eliminar tu propia cuenta.");
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [usuarios] = await connection.execute(
        `SELECT id_usuario AS idUsuario,nombre,email,rol,activo
         FROM usuarios WHERE id_usuario=? FOR UPDATE`,
        [idUsuario],
      );
      const usuario = usuarios[0];
      if (!usuario) throw new AppError(404, "Usuario no encontrado.");
      if (usuario.rol === "ADMIN") {
        throw new AppError(
          409,
          "No se puede eliminar otra cuenta administradora.",
        );
      }
      if (usuario.activo) {
        throw new AppError(
          409,
          "Primero tenés que bloquear el acceso de esta cuenta.",
        );
      }
      if (usuario.email.toLowerCase() !== req.body.emailConfirmacion) {
        throw new AppError(400, "El correo de confirmación no coincide.");
      }
      const [viajes] = await connection.execute(
        "SELECT COUNT(*) AS cantidad FROM viajes WHERE id_usuario=?",
        [idUsuario],
      );
      await connection.execute(
        `INSERT INTO acciones_admin
         (id_admin,id_usuario,accion,motivo,usuario_nombre,usuario_email)
         VALUES (?,?,?,?,?,?)`,
        [
          req.usuario.idUsuario,
          idUsuario,
          "ELIMINAR",
          req.body.motivo,
          usuario.nombre,
          usuario.email,
        ],
      );
      await eliminarDatosDeUsuarios(connection, [idUsuario]);
      await connection.execute("DELETE FROM usuarios WHERE id_usuario=?", [
        idUsuario,
      ]);
      await connection.commit();
      res.json({
        eliminado: true,
        cantidadViajesEliminados: Number(viajes[0].cantidad),
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }),
);

router.get(
  "/limpieza",
  asyncHandler(async (req, res) => {
    const vista = await obtenerVistaLimpieza(
      pool,
      req.usuario.idUsuario,
      false,
    );
    res.json({
      cuentaConservada: req.usuario.email,
      cantidadUsuarios: vista.cantidadUsuarios,
      cantidadViajes: vista.cantidadViajes,
      cantidadHistorial: vista.cantidadHistorial,
    });
  }),
);

router.delete(
  "/limpieza",
  validar(
    z.object({
      emailConfirmacion: z
        .email()
        .max(150)
        .transform((email) => email.toLowerCase()),
      contrasena: z.string().min(8).max(72),
      confirmacion: z.literal("ELIMINAR USUARIOS"),
    }),
  ),
  asyncHandler(async (req, res) => {
    if (req.body.emailConfirmacion !== req.usuario.email.toLowerCase()) {
      throw new AppError(400, "El correo de confirmación no coincide.");
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [administradores] = await connection.execute(
        `SELECT contrasena_hash FROM usuarios
         WHERE id_usuario=? AND rol='ADMIN' AND activo=TRUE FOR UPDATE`,
        [req.usuario.idUsuario],
      );
      if (
        !administradores[0] ||
        !(await bcrypt.compare(
          req.body.contrasena,
          administradores[0].contrasena_hash,
        ))
      ) {
        throw new AppError(400, "La contraseña no es correcta.");
      }
      const vista = await obtenerVistaLimpieza(
        connection,
        req.usuario.idUsuario,
        true,
      );
      await connection.execute("DELETE FROM acciones_admin");
      if (vista.ids.length) {
        await eliminarDatosDeUsuarios(connection, vista.ids);
        await connection.query("DELETE FROM usuarios WHERE id_usuario IN (?)", [
          vista.ids,
        ]);
      }
      await connection.commit();
      res.json({
        completada: true,
        cuentaConservada: req.usuario.email,
        usuariosEliminados: vista.cantidadUsuarios,
        viajesEliminados: vista.cantidadViajes,
        historialEliminado: vista.cantidadHistorial,
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
