import jwt from "jsonwebtoken";
import { config } from "./config.js";

export const COOKIE_SESION = "brujula_session";

const opcionesCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 8 * 60 * 60 * 1000,
};

export function crearToken(usuario) {
  return jwt.sign({ email: usuario.email }, config.jwtSecret, {
    subject: String(usuario.idUsuario ?? usuario.id_usuario),
    expiresIn: config.jwtExpiresIn,
  });
}

export function establecerSesion(res, token) {
  res.cookie(COOKIE_SESION, token, opcionesCookie);
}

export function cerrarSesion(res) {
  res.clearCookie(COOKIE_SESION, {
    httpOnly: true,
    secure: opcionesCookie.secure,
    sameSite: opcionesCookie.sameSite,
    path: "/",
  });
}

export function leerCookieSesion(req) {
  const cookies = String(req.headers.cookie ?? "").split(";");
  for (const cookie of cookies) {
    const [nombre, ...valor] = cookie.trim().split("=");
    if (nombre === COOKIE_SESION) return decodeURIComponent(valor.join("="));
  }
  return null;
}
