import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { AppError } from "../errors.js";
import { pool } from "../db.js";

export async function requerirAutenticacion(req, _res, next) {
  const [type, token] = (req.headers.authorization ?? "").split(" ");
  if (type !== "Bearer" || !token) {
    return next(new AppError(401, "Se requiere un token de autenticación."));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const [rows] = await pool.execute(
      "SELECT id_usuario AS idUsuario,email,rol,activo FROM usuarios WHERE id_usuario=?",
      [Number(payload.sub)],
    );
    const usuario = rows[0];
    if (!usuario?.activo) {
      return next(
        new AppError(403, "Tu acceso a la aplicación está bloqueado."),
      );
    }
    req.usuario = usuario;
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    next(new AppError(401, "El token es inválido o venció."));
  }
}

export function requerirAdministrador(req, _res, next) {
  if (req.usuario?.rol !== "ADMIN") {
    return next(new AppError(403, "Se requiere acceso de administración."));
  }
  next();
}
