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

test("el perfil se puede consultar, editar y eliminar con contraseña", async () => {
  const marca = Date.now();
  const email = `perfil-${marca}@example.com`;
  const nuevaEmail = `perfil-editado-${marca}@example.com`;
  const contrasena = "Prueba-1234";
  const nuevaContrasena = "Prueba-5678";
  await request(app).post("/api/auth/registro").send({
    nombre: "Perfil prueba",
    email,
    contrasena,
  });
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email, contrasena });
  assert.equal(login.status, 200);
  const auth = { Authorization: `Bearer ${login.body.token}` };

  const perfil = await request(app).get("/api/auth/perfil").set(auth);
  assert.equal(perfil.status, 200);
  assert.equal(perfil.body.email, email);

  const edicion = await request(app).patch("/api/auth/perfil").set(auth).send({
    nombre: "Perfil actualizado",
    email: nuevaEmail,
    contrasenaActual: contrasena,
    contrasenaNueva: nuevaContrasena,
  });
  assert.equal(edicion.status, 200);
  assert.equal(edicion.body.usuario.nombre, "Perfil actualizado");

  const eliminacion = await request(app)
    .delete("/api/auth/perfil")
    .set({ Authorization: `Bearer ${edicion.body.token}` })
    .send({ contrasena: nuevaContrasena });
  assert.equal(eliminacion.status, 204);

  const loginEliminado = await request(app)
    .post("/api/auth/login")
    .send({ email: nuevaEmail, contrasena: nuevaContrasena });
  assert.equal(loginEliminado.status, 401);
});
