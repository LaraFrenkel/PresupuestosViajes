import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db.js';
import { config } from '../config.js';
import { AppError, asyncHandler } from '../errors.js';
import { validar } from '../validation.js';

const router = Router();
const credenciales = z.object({
  email: z.email().max(150).transform((value) => value.toLowerCase()),
  contrasena: z.string().min(8).max(72)
});

router.post('/registro', validar(credenciales.extend({ nombre: z.string().trim().min(2).max(100) })), asyncHandler(async (req, res) => {
  const { nombre, email, contrasena } = req.body;
  const hash = await bcrypt.hash(contrasena, 12);
  const [result] = await pool.execute(
    'INSERT INTO usuarios (nombre, email, contrasena_hash) VALUES (?, ?, ?)',
    [nombre, email, hash]
  );
  res.status(201).json({ idUsuario: Number(result.insertId), nombre, email });
}));

router.post('/login', validar(credenciales), asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id_usuario, nombre, email, contrasena_hash FROM usuarios WHERE email = ? AND activo = TRUE',
    [req.body.email]
  );
  const usuario = rows[0];
  if (!usuario || !(await bcrypt.compare(req.body.contrasena, usuario.contrasena_hash))) {
    throw new AppError(401, 'Email o contraseña incorrectos.');
  }
  const token = jwt.sign({ email: usuario.email }, config.jwtSecret, {
    subject: String(usuario.id_usuario),
    expiresIn: config.jwtExpiresIn
  });
  res.json({ token, usuario: { idUsuario: usuario.id_usuario, nombre: usuario.nombre, email: usuario.email } });
}));

export default router;
