import {
  eliminarOperacion,
  guardarVersion,
  listarOperaciones,
  marcarConflicto,
} from "./offline-db.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

export async function sincronizarViaje(idViaje, forzar = false) {
  const operaciones = (await listarOperaciones(idViaje)).sort(
    (a, b) => a.creadaEn - b.creadaEn,
  );
  if (!operaciones.length) return { sincronizadas: 0 };

  const estadoResponse = await fetch(
    `${API_URL}/viajes/${idViaje}/sincronizacion?desde=0`,
    { headers: headers() },
  );
  if (!estadoResponse.ok)
    throw new Error("No se pudo comprobar la versión del viaje.");
  const estado = await estadoResponse.json();
  const base = Number(operaciones[0].baseVersion ?? 0);
  if (!forzar && Number(estado.version) !== base) {
    await marcarConflicto(operaciones.map((x) => x.id));
    return {
      conflicto: true,
      versionLocal: base,
      versionServidor: estado.version,
    };
  }

  let version = Number(estado.version);
  for (const operacion of operaciones) {
    const response = await fetch(`${API_URL}${operacion.path}`, {
      method: operacion.method,
      headers: headers(),
      body: operacion.body,
    });
    if (!response.ok) {
      await marcarConflicto([operacion.id]);
      const data = await response.json().catch(() => ({}));
      throw new Error(
        data.error ?? "Un cambio pendiente no pudo sincronizarse.",
      );
    }
    version = Number(response.headers.get("X-Sync-Version") ?? version + 1);
    await eliminarOperacion(operacion.id);
  }
  await guardarVersion(idViaje, version);
  return { sincronizadas: operaciones.length, version };
}

export async function descartarPendientes(idViaje) {
  for (const operacion of await listarOperaciones(idViaje))
    await eliminarOperacion(operacion.id);
}
