import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_HOST ??= "localhost";
process.env.DB_USER ??= "root";
process.env.DB_NAME ??= "app_presupuestos_viajes";
process.env.JWT_SECRET ??= "secreto-solo-para-pruebas-automatizadas";

const { default: request } = await import("supertest");
const { app } = await import("../src/app.js");

test("GET /api/salud informa que la API está activa", async () => {
  const response = await request(app).get("/api/salud");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { estado: "ok" });
});

test("una ruta protegida rechaza peticiones sin token", async () => {
  const response = await request(app).get("/api/viajes");
  assert.equal(response.status, 401);
  assert.match(response.body.error, /token/i);
});

test("una ruta inexistente devuelve 404", async () => {
  const response = await request(app).get("/api/no-existe");
  assert.equal(response.status, 404);
});

test("una validación informa el campo y el problema en español", async () => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email: "correo-invalido", contrasena: "" });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, "Hay datos que necesitan corrección.");
  assert.ok(
    response.body.detalles.some((x) => /Correo electrónico/.test(x.message)),
  );
  assert.ok(response.body.detalles.some((x) => /Contraseña/.test(x.message)));
});
