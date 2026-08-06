import "dotenv/config";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ?? "",
  ssl:
    process.env.DB_SSL === "true"
      ? {
          rejectUnauthorized: process.env.DB_SSL_VERIFY !== "false",
          ...(process.env.DB_SSL_CA
            ? { ca: process.env.DB_SSL_CA.replaceAll("\\n", "\n") }
            : {}),
        }
      : undefined,
  multipleStatements: true,
});

try {
  let schema = await readFile(
    new URL("../database/01_schema.sql", import.meta.url),
    "utf8",
  );
  if (process.env.DB_MANAGED === "true") {
    const base = String(process.env.DB_NAME).replaceAll("`", "``");
    schema = schema.replace(
      /CREATE DATABASE IF NOT EXISTS app_presupuestos_viajes[\s\S]*?USE app_presupuestos_viajes;/,
      `USE \`${base}\`;`,
    );
  }
  await connection.query(schema);
  const baseActual =
    process.env.DB_MANAGED === "true"
      ? process.env.DB_NAME
      : "app_presupuestos_viajes";
  const columnasUsuarios = [
    [
      "rol",
      "ENUM('USUARIO','ADMIN') NOT NULL DEFAULT 'USUARIO' AFTER contrasena_hash",
    ],
    ["ultimo_acceso", "DATETIME NULL AFTER activo"],
    ["bloqueado_en", "DATETIME NULL AFTER ultimo_acceso"],
    ["motivo_bloqueo", "VARCHAR(300) NULL AFTER bloqueado_en"],
    [
      "intentos_fallidos",
      "SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER motivo_bloqueo",
    ],
    ["bloqueado_hasta", "DATETIME NULL AFTER intentos_fallidos"],
  ];
  for (const [columna, definicion] of columnasUsuarios) {
    const [existente] = await connection.execute(
      `SELECT 1 FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=? AND TABLE_NAME='usuarios' AND COLUMN_NAME=?`,
      [baseActual, columna],
    );
    if (!existente.length) {
      await connection.query(
        `ALTER TABLE usuarios ADD COLUMN ${columna} ${definicion}`,
      );
    }
  }
  const columnasAcciones = [
    ["usuario_nombre", "VARCHAR(100) NULL AFTER motivo"],
    ["usuario_email", "VARCHAR(150) NULL AFTER usuario_nombre"],
  ];
  for (const [columna, definicion] of columnasAcciones) {
    const [existente] = await connection.execute(
      `SELECT 1 FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=? AND TABLE_NAME='acciones_admin' AND COLUMN_NAME=?`,
      [baseActual, columna],
    );
    if (!existente.length) {
      await connection.query(
        `ALTER TABLE acciones_admin ADD COLUMN ${columna} ${definicion}`,
      );
    }
  }
  const columnasCotizaciones = [
    ["precio_cotizado", "DECIMAL(15,2) NULL AFTER moneda"],
    [
      "modalidad_precio",
      "ENUM('TOTAL','POR_PERSONA') NOT NULL DEFAULT 'TOTAL' AFTER precio_cotizado",
    ],
  ];
  for (const [columna, definicion] of columnasCotizaciones) {
    const [existente] = await connection.execute(
      `SELECT 1 FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=? AND TABLE_NAME='cotizaciones' AND COLUMN_NAME=?`,
      [baseActual, columna],
    );
    if (!existente.length) {
      await connection.query(
        `ALTER TABLE cotizaciones ADD COLUMN ${columna} ${definicion}`,
      );
    }
  }
  const administradores = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (administradores.length) {
    await connection.query(
      "UPDATE usuarios SET rol='ADMIN' WHERE email IN (?)",
      [administradores],
    );
  }
  console.log("Base de datos preparada correctamente.");
} finally {
  await connection.end();
}
