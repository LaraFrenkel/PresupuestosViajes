import { AppError } from "./errors.js";

const nombres = {
  nombre: "Nombre",
  email: "Correo electrónico",
  contrasena: "Contraseña",
  fechaSalida: "Fecha de salida",
  fechaRegreso: "Fecha de regreso",
  fechaCotizacion: "Fecha de cotización",
  vigenteHasta: "Vigente hasta",
  fechaVencimiento: "Fecha de vencimiento",
  fecha: "Fecha",
  hora: "Hora",
  agencia: "Agencia",
  puerto: "Puerto",
  descripcion: "Descripción",
  importe: "Importe",
  moneda: "Moneda",
  cantidad: "Cantidad",
  tasa: "Tipo de cambio",
  participanteIds: "Participantes",
  aportes: "Quién pagó",
  beneficiarios: "A quién correspondía",
  aplicaciones: "Aplicación del pago",
};

function detalle(issue) {
  const clave = issue.path?.at(-1);
  const campo = nombres[clave] ?? (typeof clave === "string" ? clave : "Dato");
  if (issue.code === "custom")
    return { campo, message: `${campo}: ${issue.message}` };
  if (issue.code === "invalid_type")
    return { campo, message: `${campo}: valor inválido.` };
  if (issue.code === "invalid_format")
    return { campo, message: `${campo}: formato inválido.` };
  if (issue.code === "invalid_value")
    return { campo, message: `${campo}: elegí una opción válida.` };
  if (issue.code === "too_small") {
    const texto =
      issue.origin === "string"
        ? `debe tener al menos ${issue.minimum} caracteres.`
        : issue.origin === "array"
          ? "seleccioná al menos una opción."
          : "debe ser mayor que cero.";
    return { campo, message: `${campo}: ${texto}` };
  }
  if (issue.code === "too_big")
    return { campo, message: `${campo}: supera el máximo permitido.` };
  return { campo, message: `${campo}: revisá este dato.` };
}

export const validar =
  (schema, source = "body") =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(
        new AppError(
          400,
          "Hay datos que necesitan corrección.",
          result.error.issues.map(detalle),
        ),
      );
    }
    req[source] = result.data;
    next();
  };
