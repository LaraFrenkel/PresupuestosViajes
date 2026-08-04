import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "../db.js";
import { config } from "../config.js";
import { AppError, asyncHandler } from "../errors.js";
import { validar } from "../validation.js";
import { requerirAutenticacion } from "../middleware/auth.js";

const router = Router();
const credenciales = z.object({
  email: z
    .email()
    .max(150)
    .transform((value) => value.toLowerCase()),
  contrasena: z.string().min(8).max(72),
});

router.post(
  "/registro",
  validar(credenciales.extend({ nombre: z.string().trim().min(2).max(100) })),
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
  validar(credenciales),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      "SELECT id_usuario, nombre, email, contrasena_hash, rol FROM usuarios WHERE email = ? AND activo = TRUE",
      [req.body.email],
    );
    const usuario = rows[0];
    if (
      !usuario ||
      !(await bcrypt.compare(req.body.contrasena, usuario.contrasena_hash))
    ) {
      throw new AppError(401, "Email o contraseña incorrectos.");
    }
    const token = jwt.sign({ email: usuario.email }, config.jwtSecret, {
      subject: String(usuario.id_usuario),
      expiresIn: config.jwtExpiresIn,
    });
    await pool.execute(
      "UPDATE usuarios SET ultimo_acceso=NOW() WHERE id_usuario=?",
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
    contrasenaNueva: z.string().min(8).max(72).optional().or(z.literal("")),
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
    const token = jwt.sign({ email: usuario.email }, config.jwtSecret, {
      subject: String(usuario.idUsuario),
      expiresIn: config.jwtExpiresIn,
    });
    res.json({ usuario, token });
  }),
);

router.delete(
  "/perfil",
  requerirAutenticacion,
  validar(
    z.object({
      contrasena: z.string().min(8).max(72),
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
