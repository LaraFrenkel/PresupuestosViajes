import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { AppError } from '../errors.js';

export function requerirAutenticacion(req, _res, next) {
  const [type, token] = (req.headers.authorization ?? '').split(' ');
  if (type !== 'Bearer' || !token) {
    return next(new AppError(401, 'Se requiere un token de autenticación.'));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.usuario = { idUsuario: Number(payload.sub), email: payload.email };
    next();
  } catch {
    next(new AppError(401, 'El token es inválido o venció.'));
  }
}
