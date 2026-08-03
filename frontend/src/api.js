const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

export async function api(path, options = {}) {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
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
  return data;
}
