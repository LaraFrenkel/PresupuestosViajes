const DB_NAME = "brujula-offline";
const STORE = "respuestas";
const OPERACIONES = "operaciones";
const META = "meta";

function abrir() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: "key" });
      if (!request.result.objectStoreNames.contains(OPERACIONES))
        request.result.createObjectStore(OPERACIONES, {
          keyPath: "id",
          autoIncrement: true,
        });
      if (!request.result.objectStoreNames.contains(META))
        request.result.createObjectStore(META, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idUsuario() {
  return JSON.parse(localStorage.getItem("usuario") || "null")?.idUsuario;
}

function clave(path) {
  const usuario = JSON.parse(localStorage.getItem("usuario") || "null");
  return `${usuario?.idUsuario ?? "anonimo"}:${path}`;
}

export async function guardarRespuesta(path, data) {
  const db = await abrir();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({
        key: clave(path),
        data,
        guardadoEn: Date.now(),
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function leerRespuesta(path) {
  const db = await abrir();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(clave(path));
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function guardarVersion(idViaje, version) {
  const db = await abrir();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(META, "readwrite");
      tx.objectStore(META).put({
        key: `${idUsuario()}:${idViaje}`,
        version: Number(version),
        actualizadoEn: Date.now(),
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function leerVersion(idViaje) {
  const db = await abrir();
  try {
    const item = await new Promise((resolve, reject) => {
      const request = db
        .transaction(META)
        .objectStore(META)
        .get(`${idUsuario()}:${idViaje}`);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return Number(item?.version ?? 0);
  } finally {
    db.close();
  }
}

export async function guardarOperacion(operacion) {
  const db = await abrir();
  try {
    const id = await new Promise((resolve, reject) => {
      const tx = db.transaction(OPERACIONES, "readwrite");
      const request = tx.objectStore(OPERACIONES).add({
        ...operacion,
        idUsuario: idUsuario(),
        creadaEn: Date.now(),
        estado: "PENDIENTE",
      });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    window.dispatchEvent(new Event("brujula:cola"));
    return id;
  } finally {
    db.close();
  }
}

export async function listarOperaciones(idViaje = null) {
  const db = await abrir();
  try {
    const items = await new Promise((resolve, reject) => {
      const request = db
        .transaction(OPERACIONES)
        .objectStore(OPERACIONES)
        .getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return items.filter(
      (x) =>
        Number(x.idUsuario) === Number(idUsuario()) &&
        (!idViaje || Number(x.idViaje) === Number(idViaje)),
    );
  } finally {
    db.close();
  }
}

export async function eliminarOperacion(id) {
  const db = await abrir();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(OPERACIONES, "readwrite");
      tx.objectStore(OPERACIONES).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    window.dispatchEvent(new Event("brujula:cola"));
  } finally {
    db.close();
  }
}

export async function marcarConflicto(ids) {
  const db = await abrir();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(OPERACIONES, "readwrite");
      const store = tx.objectStore(OPERACIONES);
      for (const id of ids) {
        const request = store.get(id);
        request.onsuccess = () =>
          request.result &&
          store.put({ ...request.result, estado: "CONFLICTO" });
      }
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    window.dispatchEvent(new Event("brujula:cola"));
  } finally {
    db.close();
  }
}
