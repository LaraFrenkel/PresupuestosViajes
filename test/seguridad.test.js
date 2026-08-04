import test, { after } from "node:test";
import assert from "node:assert/strict";

process.env.DB_HOST ??= "localhost";
process.env.DB_USER ??= "root";
process.env.DB_NAME ??= "app_presupuestos_viajes";
process.env.JWT_SECRET ??= "secreto-solo-para-pruebas-automatizadas";

const { default: request } = await import("supertest");
const { app } = await import("../src/app.js");
const { pool } = await import("../src/db.js");

after(async () => pool.end());

test("aplica contraseñas fuertes y bloqueo temporal tras cinco fallos", async () => {
  const marca = Date.now();
  const email = `seguridad-${marca}@example.com`;
  const debil = await request(app).post("/api/auth/registro").send({
    nombre: "Seguridad prueba",
    email,
    contrasena: "solodebil",
  });
  assert.equal(debil.status, 400);

  const registro = await request(app).post("/api/auth/registro").send({
    nombre: "Seguridad prueba",
    email,
    contrasena: "Segura-1234",
  });
  assert.equal(registro.status, 201);
  for (let intento = 0; intento < 5; intento += 1) {
    const fallo = await request(app)
      .post("/api/auth/login")
      .send({ email, contrasena: "Erronea-1234" });
    assert.equal(fallo.status, 401);
  }
  const bloqueado = await request(app)
    .post("/api/auth/login")
    .send({ email, contrasena: "Segura-1234" });
  assert.equal(bloqueado.status, 429);

  const [eventos] = await pool.execute(
    "SELECT tipo FROM eventos_seguridad WHERE id_usuario=? ORDER BY id_evento",
    [registro.body.idUsuario],
  );
  assert.equal(eventos.at(-1).tipo, "BLOQUEO_TEMPORAL");
  await pool.execute("DELETE FROM eventos_seguridad WHERE id_usuario=?", [
    registro.body.idUsuario,
  ]);
  await pool.execute("DELETE FROM usuarios WHERE id_usuario=?", [
    registro.body.idUsuario,
  ]);
});

test("la sesión funciona con cookie HttpOnly y se elimina al salir", async () => {
  const marca = Date.now();
  const email = `cookie-${marca}@example.com`;
  const contrasena = "Segura-1234";
  const registro = await request(app).post("/api/auth/registro").send({
    nombre: "Cookie prueba",
    email,
    contrasena,
  });
  const agente = request.agent(app);
  const login = await agente
    .post("/api/auth/login")
    .send({ email, contrasena });
  assert.equal(login.status, 200);
  assert.match(login.headers["set-cookie"][0], /brujula_session=/);
  assert.match(login.headers["set-cookie"][0], /HttpOnly/);
  assert.match(login.headers["set-cookie"][0], /SameSite=Lax/);

  const perfil = await agente.get("/api/auth/perfil");
  assert.equal(perfil.status, 200);
  assert.equal(perfil.body.email, email);
  const csrf = await agente.patch("/api/auth/perfil").send({
    nombre: "Intento externo",
    email,
    contrasenaActual: "",
    contrasenaNueva: "",
  });
  assert.equal(csrf.status, 403);

  const logout = await agente.post("/api/auth/logout");
  assert.equal(logout.status, 204);
  const perfilCerrado = await agente.get("/api/auth/perfil");
  assert.equal(perfilCerrado.status, 401);
  await pool.execute("DELETE FROM usuarios WHERE id_usuario=?", [
    registro.body.idUsuario,
  ]);
});
