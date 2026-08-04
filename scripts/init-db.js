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
      ? { rejectUnauthorized: process.env.DB_SSL_VERIFY !== "false" }
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
  console.log("Base de datos preparada correctamente.");
} finally {
  await connection.end();
}
