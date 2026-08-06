import {
  guardarOperacion,
  guardarRespuesta,
  guardarVersion,
  borrarDatosLocales,
  leerRespuesta,
  leerVersion,
} from "./offline-db.js";

const API_URL = import.meta.env.PROD
  ? "/api"
  : (import.meta.env.VITE_API_URL ?? "http://localhost:3000/api");

function persistirEnSegundoPlano(promesa) {
  void promesa.catch(() => undefined);
}

export async function api(path, options = {}) {
  const token = localStorage.getItem("token");
  const tieneSesion = Boolean(localStorage.getItem("usuario"));
  const method = (options.method ?? "GET").toUpperCase();
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    window.dispatchEvent(new CustomEvent("brujula:conexion", { detail: true }));
  } catch (error) {
    window.dispatchEvent(
      new CustomEvent("brujula:conexion", { detail: false }),
    );
    if (method === "GET" && tieneSesion) {
      const guardada = await leerRespuesta(path).catch(() => null);
      if (guardada) return guardada.data;
      throw new Error(
        "No hay conexión y esta información todavía no está guardada en el dispositivo.",
      );
    }
    const coincidencia = path.match(/^\/viajes\/(\d+)/);
    if (method !== "GET" && tieneSesion && coincidencia) {
      const idViaje = Number(coincidencia[1]);
      await guardarOperacion({
        idViaje,
        path,
        method,
        body: options.body ?? null,
        baseVersion: await leerVersion(idViaje),
      });
      return { pendienteSincronizar: true };
    }
    throw new Error("No se pudo conectar con el servidor.");
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && tieneSesion) {
      await borrarDatosLocales().catch(() => undefined);
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      window.dispatchEvent(new Event("brujula:sesion-expirada"));
    }
    const detalles = Array.isArray(data.detalles)
      ? [
          ...new Set(
            data.detalles.map((detalle) => detalle.message).filter(Boolean),
          ),
        ]
      : [];
    const mensaje = data.error ?? "No se pudo completar la operación.";
    throw new Error(detalles.length ? detalles.join(" ") : mensaje);
  }
  if (method === "GET" && tieneSesion)
    persistirEnSegundoPlano(guardarRespuesta(path, data));
  const idViaje = path.match(/^\/viajes\/(\d+)/)?.[1];
  const version = response.headers.get("X-Sync-Version");
  if (idViaje && version)
    persistirEnSegundoPlano(
      guardarVersion(Number(idViaje), Number(version)),
    );
  if (idViaje && path.includes("/sincronizacion") && data.version !== undefined)
    persistirEnSegundoPlano(guardarVersion(Number(idViaje), data.version));
  return data;
}
