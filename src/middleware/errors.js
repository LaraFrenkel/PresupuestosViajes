import { AppError } from '../errors.js';

export function rutaNoEncontrada(req, _res, next) {
  next(new AppError(404, `No existe la ruta ${req.method} ${req.originalUrl}.`));
}

export function manejarErrores(error, _req, res, _next) {
  if (error?.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Ya existe un registro con esos datos.' });
  }
  if (error?.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ error: 'El registro tiene información asociada y no puede eliminarse.' });
  }
  if (error?.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: 'La referencia indicada no existe.' });
  }

  const status = error instanceof AppError ? error.status : 500;
  const body = { error: status === 500 ? 'Ocurrió un error interno.' : error.message };
  if (error.details) body.detalles = error.details;
  if (status === 500) console.error(error);
  res.status(status).json(body);
}
