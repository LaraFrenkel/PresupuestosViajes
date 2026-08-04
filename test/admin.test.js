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

test("un administrador puede bloquear y restaurar el acceso sin ver datos sensibles", async () => {
  const marca = Date.now();
  const adminEmail = `admin-${marca}@example.com`;
  const usuarioEmail = `usuario-admin-${marca}@example.com`;
  const contrasena = "Prueba-1234";
  const adminRegistro = await request(app).post("/api/auth/registro").send({
    nombre: "Admin prueba",
    email: adminEmail,
    contrasena,
  });
  const usuarioRegistro = await request(app).post("/api/auth/registro").send({
    nombre: "Usuario prueba",
    email: usuarioEmail,
    contrasena,
  });
  await pool.execute("UPDATE usuarios SET rol='ADMIN' WHERE id_usuario=?", [
    adminRegistro.body.idUsuario,
  ]);
  const adminLogin = await request(app)
    .post("/api/auth/login")
    .send({ email: adminEmail, contrasena });
  const usuarioLogin = await request(app)
    .post("/api/auth/login")
    .send({ email: usuarioEmail, contrasena });
  const adminAuth = { Authorization: `Bearer ${adminLogin.body.token}` };
  const usuarioAuth = { Authorization: `Bearer ${usuarioLogin.body.token}` };

  const lista = await request(app).get("/api/admin/usuarios").set(adminAuth);
  assert.equal(lista.status, 200);
  const usuario = lista.body.find(
    (item) => item.idUsuario === usuarioRegistro.body.idUsuario,
  );
  assert.equal(usuario.email, usuarioEmail);
  assert.equal("contrasena_hash" in usuario, false);

  const bloqueo = await request(app)
    .patch(`/api/admin/usuarios/${usuarioRegistro.body.idUsuario}/acceso`)
    .set(adminAuth)
    .send({ accion: "BLOQUEAR", motivo: "Actividad sospechosa de prueba" });
  assert.equal(bloqueo.status, 200);
  const sesionBloqueada = await request(app)
    .get("/api/viajes")
    .set(usuarioAuth);
  assert.equal(sesionBloqueada.status, 403);

  const restauracion = await request(app)
    .patch(`/api/admin/usuarios/${usuarioRegistro.body.idUsuario}/acceso`)
    .set(adminAuth)
    .send({
      accion: "RESTAURAR",
      motivo: "Identidad verificada correctamente",
    });
  assert.equal(restauracion.status, 200);
  const sesionRestaurada = await request(app)
    .get("/api/viajes")
    .set(usuarioAuth);
  assert.equal(sesionRestaurada.status, 200);

  const historial = await request(app)
    .get("/api/admin/acciones")
    .set(adminAuth);
  assert.equal(historial.status, 200);
  assert.ok(historial.body.some((accion) => accion.accion === "BLOQUEAR"));

  await pool.execute("DELETE FROM acciones_admin WHERE id_admin=?", [
    adminRegistro.body.idUsuario,
  ]);
  await pool.execute("DELETE FROM usuarios WHERE id_usuario IN (?,?)", [
    adminRegistro.body.idUsuario,
    usuarioRegistro.body.idUsuario,
  ]);
});
