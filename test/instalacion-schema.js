import "dotenv/config";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const nombreBase = `app_presupuestos_viajes_qa_${process.pid}`;
const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ?? "",
  multipleStatements: true,
});

try {
  await connection.query(
    "SET SESSION sql_mode=CONCAT(@@sql_mode, ',ANSI_QUOTES')",
  );
  const original = await readFile(
    new URL("../database/01_schema.sql", import.meta.url),
    "utf8",
  );
  const schemaTemporal = original.replaceAll(
    "app_presupuestos_viajes",
    nombreBase,
  );
  await connection.query(schemaTemporal);

  const [tablas] = await connection.execute(
    `SELECT table_name FROM information_schema.tables WHERE table_schema=?`,
    [nombreBase],
  );
  const nombres = new Set(tablas.map((x) => x.TABLE_NAME ?? x.table_name));
  for (const tabla of [
    "usuarios",
    "viajes",
    "participantes",
    "cotizaciones",
    "presupuestos",
    "cuotas",
    "pagos",
    "gastos",
    "transferencias",
  ]) {
    assert.ok(nombres.has(tabla), `Falta la tabla ${tabla}`);
  }

  const [columnasPago] = await connection.execute(
    `SELECT column_name FROM information_schema.columns WHERE table_schema=? AND table_name='pagos'`,
    [nombreBase],
  );
  const columnas = new Set(
    columnasPago.map((x) => x.COLUMN_NAME ?? x.column_name),
  );
  assert.ok(columnas.has("estado"));
  assert.ok(columnas.has("revertido_en"));
  console.log(`✓ Instalación limpia verificada con ${tablas.length} tablas.`);
} finally {
  await connection.query(`DROP DATABASE IF EXISTS \`${nombreBase}\``);
  await connection.end();
}
