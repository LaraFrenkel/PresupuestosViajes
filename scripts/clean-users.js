import "dotenv/config";
import mysql from "mysql2/promise";

const keepEmail = String(process.env.KEEP_USER_EMAIL ?? "")
  .trim()
  .toLowerCase();
const execute = process.argv.includes("--execute");
const confirmation = process.env.CONFIRM_CLEAN_USERS;

if (!keepEmail) {
  throw new Error(
    "Falta KEEP_USER_EMAIL con el correo de la única cuenta que se conservará.",
  );
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME,
  ssl:
    process.env.DB_SSL === "true"
      ? {
          rejectUnauthorized: process.env.DB_SSL_VERIFY !== "false",
          ...(process.env.DB_SSL_CA
            ? { ca: process.env.DB_SSL_CA.replaceAll("\\n", "\n") }
            : {}),
        }
      : undefined,
});

try {
  if (execute) await connection.beginTransaction();
  const [conservados] = await connection.execute(
    `SELECT id_usuario AS idUsuario,nombre,email,rol
     FROM usuarios WHERE LOWER(email)=?${execute ? " FOR UPDATE" : ""}`,
    [keepEmail],
  );
  if (conservados.length !== 1) {
    throw new Error(
      `No se encontró una única cuenta para conservar con el correo ${keepEmail}. No se eliminó nada.`,
    );
  }
  const cuenta = conservados[0];
  const [usuarios] = await connection.execute(
    `SELECT id_usuario AS idUsuario,nombre,email
     FROM usuarios WHERE id_usuario<>? ORDER BY id_usuario${execute ? " FOR UPDATE" : ""}`,
    [cuenta.idUsuario],
  );
  const ids = usuarios.map((usuario) => usuario.idUsuario);
  let cantidadViajes = 0;
  if (ids.length) {
    const [viajes] = await connection.query(
      "SELECT COUNT(*) AS cantidad FROM viajes WHERE id_usuario IN (?)",
      [ids],
    );
    cantidadViajes = Number(viajes[0].cantidad);
  }
  const [historial] = await connection.execute(
    "SELECT COUNT(*) AS cantidad FROM acciones_admin",
  );

  console.log("Cuenta que se conservará:");
  console.log(`- ${cuenta.nombre} <${cuenta.email}> (${cuenta.rol})`);
  console.log("Datos que se eliminarán:");
  console.log(`- ${usuarios.length} usuarios`);
  console.log(`- ${cantidadViajes} viajes pertenecientes a esos usuarios`);
  console.log(
    `- ${Number(historial[0].cantidad)} registros del historial administrativo`,
  );

  if (!execute) {
    console.log("Vista previa completada. No se modificó ningún dato.");
    console.log(
      "Para ejecutar: agregá --execute y definí CONFIRM_CLEAN_USERS=ELIMINAR_USUARIOS.",
    );
    process.exitCode = 0;
  } else {
    if (confirmation !== "ELIMINAR_USUARIOS") {
      throw new Error(
        "Confirmación inválida. Debe ser CONFIRM_CLEAN_USERS=ELIMINAR_USUARIOS.",
      );
    }
    await connection.execute("DELETE FROM acciones_admin");
    if (ids.length) {
      await connection.query("DELETE FROM usuarios WHERE id_usuario IN (?)", [
        ids,
      ]);
    }
    await connection.commit();
    console.log("Limpieza completada correctamente.");
    console.log(`Se conservó únicamente la cuenta ${cuenta.email}.`);
  }
} catch (error) {
  if (execute) await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
