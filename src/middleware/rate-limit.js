import { AppError } from "../errors.js";

const registros = new Map();

setInterval(
  () => {
    const ahora = Date.now();
    for (const [clave, registro] of registros) {
      if (registro.reiniciaEn <= ahora) registros.delete(clave);
    }
  },
  10 * 60 * 1000,
).unref();

export function limitarSolicitudes({ nombre, maximo, ventanaMs, clave }) {
  return (req, res, next) => {
    const identificador = clave?.(req) ?? req.ip ?? "desconocida";
    const key = `${nombre}:${identificador}`;
    const ahora = Date.now();
    let registro = registros.get(key);
    if (!registro || registro.reiniciaEn <= ahora) {
      registro = { cantidad: 0, reiniciaEn: ahora + ventanaMs };
      registros.set(key, registro);
    }
    registro.cantidad += 1;
    res.setHeader("X-RateLimit-Limit", String(maximo));
    res.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(0, maximo - registro.cantidad)),
    );
    if (registro.cantidad > maximo) {
      const segundos = Math.max(
        1,
        Math.ceil((registro.reiniciaEn - ahora) / 1000),
      );
      res.setHeader("Retry-After", String(segundos));
      return next(
        new AppError(
          429,
          "Demasiados intentos. Esperá unos minutos antes de volver a probar.",
        ),
      );
    }
    next();
  };
}

export const limitarLogin = limitarSolicitudes({
  nombre: "login",
  maximo: 10,
  ventanaMs: 15 * 60 * 1000,
  clave: (req) => `${req.ip}:${String(req.body?.email ?? "").toLowerCase()}`,
});

export const limitarRegistro = limitarSolicitudes({
  nombre: "registro",
  maximo: 5,
  ventanaMs: 60 * 60 * 1000,
});

export const limitarAdministracion = limitarSolicitudes({
  nombre: "administracion",
  maximo: 60,
  ventanaMs: 15 * 60 * 1000,
  clave: (req) => String(req.usuario?.idUsuario ?? req.ip),
});
