import { pool } from "../db.js";

async function registrar(req) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO sincronizacion_viaje (id_viaje,version,id_usuario_ultimo)
       VALUES (?,1,?) ON DUPLICATE KEY UPDATE version=version+1,id_usuario_ultimo=VALUES(id_usuario_ultimo)`,
      [req.params.idViaje, req.usuario.idUsuario],
    );
    const [actual] = await connection.execute(
      "SELECT version FROM sincronizacion_viaje WHERE id_viaje=? FOR UPDATE",
      [req.params.idViaje],
    );
    const version = Number(actual[0].version);
    await connection.execute(
      `INSERT INTO cambios_sincronizacion (id_viaje,version,id_usuario,accion,recurso)
       VALUES (?,?,?,?,?)`,
      [
        req.params.idViaje,
        version,
        req.usuario.idUsuario,
        req.method,
        req.originalUrl.split("?")[0],
      ],
    );
    await connection.commit();
    return version;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export function versionarMutacion(req, res, next) {
  if (
    ["GET", "HEAD", "OPTIONS"].includes(req.method) ||
    req.originalUrl.endsWith("/permanente")
  )
    return next();
  const jsonOriginal = res.json.bind(res);
  const endOriginal = res.end.bind(res);
  let finalizando = false;

  async function antesDeResponder(continuar) {
    if (finalizando || res.statusCode >= 400) return continuar();
    finalizando = true;
    try {
      const version = await registrar(req);
      res.setHeader("X-Sync-Version", String(version));
      continuar();
    } catch (error) {
      next(error);
    }
  }

  res.json = function jsonVersionado(body) {
    void antesDeResponder(() => jsonOriginal(body));
    return res;
  };
  res.end = function endVersionado(...args) {
    if (finalizando) return endOriginal(...args);
    void antesDeResponder(() => endOriginal(...args));
    return res;
  };
  next();
}
