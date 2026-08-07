import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db.js";
import { AppError, asyncHandler } from "../errors.js";
import { validar } from "../validation.js";
import { requerirAutenticacion } from "../middleware/auth.js";
import { limitarLogin, limitarRegistro } from "../middleware/rate-limit.js";
import { cerrarSesion, crearToken, establecerSesion } from "../session.js";

const router = Router();
const contrasenaFuerte = z
  .string()
  .min(10)
  .max(72)
  .regex(/[a-z]/, "Debe incluir una letra minúscula.")
  .regex(/[A-Z]/, "Debe incluir una letra mayúscula.")
  .regex(/[0-9]/, "Debe incluir un número.");
const credenciales = z.object({
  email: z
    .email()
    .max(150)
    .transform((value) => value.trim().toLowerCase()),
  contrasena: z.string().min(1).max(72),
});

router.post(
  "/registro",
  limitarRegistro,
  validar(
    credenciales.extend({
      nombre: z.string().trim().min(2).max(100),
      contrasena: contrasenaFuerte,
    }),
  ),
  asyncHandler(async (req, res) => {
    const { nombre, email, contrasena } = req.body;
    const hash = await bcrypt.hash(contrasena, 12);
    const [result] = await pool.execute(
      "INSERT INTO usuarios (nombre, email, contrasena_hash) VALUES (?, ?, ?)",
      [nombre, email, hash],
    );
    res.status(201).json({ idUsuario: Number(result.insertId), nombre, email });
  }),
);

router.post(
  "/login",
  limitarLogin,
  validar(credenciales),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT id_usuario,nombre,email,contrasena_hash,rol,activo,
       intentos_fallidos,bloqueado_hasta
       FROM usuarios WHERE email=?`,
      [req.body.email],
    );
    const usuario = rows[0];
    if (
      usuario?.bloqueado_hasta &&
      new Date(usuario.bloqueado_hasta).getTime() > Date.now()
    ) {
      throw new AppError(
        429,
        "La cuenta está temporalmente bloqueada por varios intentos fallidos. Probá nuevamente más tarde.",
      );
    }
    const hashComparacion =
      usuario?.contrasena_hash ??
      "$2b$12$C6UzMDM.H6dfI/f/IKcEe.yrH5OVmO9pQZ8WfE5IKzJ5YVZ9Yp6Ke";
    const contrasenaCorrecta = await bcrypt.compare(
      req.body.contrasena,
      hashComparacion,
    );
    if (!usuario || !usuario.activo || !contrasenaCorrecta) {
      if (usuario?.activo) {
        const intentos = Number(usuario.intentos_fallidos) + 1;
        const bloquear = intentos >= 5;
        await pool.execute(
          `UPDATE usuarios SET intentos_fallidos=?,
           bloqueado_hasta=${bloquear ? "DATE_ADD(NOW(),INTERVAL 15 MINUTE)" : "NULL"}
           WHERE id_usuario=?`,
          [intentos, usuario.id_usuario],
        );
        await pool.execute(
          `INSERT INTO eventos_seguridad
           (id_usuario,tipo,email_intentado,ip,detalle) VALUES (?,?,?,?,?)`,
          [
            usuario.id_usuario,
            bloquear ? "BLOQUEO_TEMPORAL" : "LOGIN_FALLIDO",
            req.body.email,
            req.ip,
            bloquear
              ? "Cuenta bloqueada durante 15 minutos por intentos fallidos."
              : `Intento fallido ${intentos} de 5.`,
          ],
        );
      }
      throw new AppError(401, "Email o contraseña incorrectos.");
    }
    const token = crearToken(usuario);
    establecerSesion(res, token);
    await pool.execute(
      `UPDATE usuarios SET ultimo_acceso=NOW(),intentos_fallidos=0,
       bloqueado_hasta=NULL WHERE id_usuario=?`,
      [usuario.id_usuario],
    );
    res.json({
      token,
      usuario: {
        idUsuario: usuario.id_usuario,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  }),
);

router.get(
  "/perfil",
  requerirAutenticacion,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      "SELECT id_usuario AS idUsuario, nombre, email, rol, creado_en AS creadoEn, ultimo_acceso AS ultimoAcceso FROM usuarios WHERE id_usuario=? AND activo=TRUE",
      [req.usuario.idUsuario],
    );
    if (!rows[0]) throw new AppError(404, "La cuenta no existe.");
    res.json(rows[0]);
  }),
);

const actualizarPerfil = z
  .object({
    nombre: z.string().trim().min(2).max(100),
    email: z
      .email()
      .max(150)
      .transform((value) => value.toLowerCase()),
    contrasenaActual: z.string().max(72).optional().or(z.literal("")),
    contrasenaNueva: contrasenaFuerte.optional().or(z.literal("")),
  })
  .refine((data) => !data.contrasenaNueva || data.contrasenaActual, {
    message: "Ingresá tu contraseña actual para cambiarla.",
    path: ["contrasenaActual"],
  });

router.patch(
  "/perfil",
  requerirAutenticacion,
  validar(actualizarPerfil),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      "SELECT contrasena_hash FROM usuarios WHERE id_usuario=? AND activo=TRUE",
      [req.usuario.idUsuario],
    );
    if (!rows[0]) throw new AppError(404, "La cuenta no existe.");
    let hash = rows[0].contrasena_hash;
    if (req.body.contrasenaNueva) {
      if (!(await bcrypt.compare(req.body.contrasenaActual, hash))) {
        throw new AppError(400, "La contraseña actual no es correcta.");
      }
      hash = await bcrypt.hash(req.body.contrasenaNueva, 12);
    }
    await pool.execute(
      "UPDATE usuarios SET nombre=?,email=?,contrasena_hash=? WHERE id_usuario=?",
      [req.body.nombre, req.body.email, hash, req.usuario.idUsuario],
    );
    const usuario = {
      idUsuario: req.usuario.idUsuario,
      nombre: req.body.nombre,
      email: req.body.email,
      rol: req.usuario.rol,
    };
    const token = crearToken(usuario);
    establecerSesion(res, token);
    res.json({ usuario, token });
  }),
);

router.post("/logout", (_req, res) => {
  cerrarSesion(res);
  res.status(204).end();
});

router.delete(
  "/perfil",
  requerirAutenticacion,
  validar(
    z.object({
      contrasena: z.string().min(1).max(72),
    }),
  ),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      "SELECT contrasena_hash FROM usuarios WHERE id_usuario=? AND activo=TRUE",
      [req.usuario.idUsuario],
    );
    if (
      !rows[0] ||
      !(await bcrypt.compare(req.body.contrasena, rows[0].contrasena_hash))
    ) {
      throw new AppError(400, "La contraseña no es correcta.");
    }
    await pool.execute("DELETE FROM usuarios WHERE id_usuario=?", [
      req.usuario.idUsuario,
    ]);
    res.status(204).end();
  }),
);

export default router;
