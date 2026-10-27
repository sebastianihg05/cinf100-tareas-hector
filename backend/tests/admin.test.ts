import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';
import { autorizacion, borrarUsuarios, CONTRASENA, crearUsuario } from './ayudantes';

const PREFIJO = 'prueba.admin.';
let admin: string;
let idAdmin: number;

test.before(async () => {
  await borrarUsuarios(PREFIJO);
  idAdmin = await crearUsuario(`${PREFIJO}admin@unab.cl`, 'aprobada', 'administrador');
  admin = autorizacion(idAdmin);
});

test.after(async () => {
  await borrarUsuarios(PREFIJO);
  await pool.end();
});

test('el administrador ve las solicitudes pendientes', async () => {
  const id = await crearUsuario(`${PREFIJO}lista@unab.cl`, 'pendiente');
  const respuesta = await request(app).get('/api/admin/solicitudes').set('Authorization', admin);

  assert.equal(respuesta.status, 200);
  const ids = respuesta.body.solicitudes.map((s: { id: number }) => s.id);
  assert.ok(ids.includes(id));
  assert.ok(respuesta.body.solicitudes.every((s: { estado: string }) => s.estado === 'pendiente'));
});

test('el administrador ve todos los usuarios', async () => {
  const respuesta = await request(app).get('/api/admin/usuarios').set('Authorization', admin);

  assert.equal(respuesta.status, 200);
  assert.ok(respuesta.body.usuarios.some((u: { id: number }) => u.id === idAdmin));
});

test('aprobar asigna el rol, registra la decisión y permite iniciar sesión', async () => {
  const correo = `${PREFIJO}aprobar@unab.cl`;
  const id = await crearUsuario(correo, 'pendiente');

  const respuesta = await request(app)
    .post(`/api/admin/solicitudes/${id}/aprobar`)
    .set('Authorization', admin)
    .send({ rol: 'conductor' });

  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.body.usuario.estado, 'aprobada');
  assert.equal(respuesta.body.usuario.rol, 'conductor');

  const { rows } = await pool.query('SELECT decidido_por, decidido_en FROM usuarios WHERE id = $1', [id]);
  assert.equal(rows[0].decidido_por, idAdmin);
  assert.ok(rows[0].decidido_en);

  const login = await request(app).post('/api/auth/login').send({ correo, contrasena: CONTRASENA });
  assert.equal(login.status, 200);
});

test('rechazar deja la cuenta rechazada y sin acceso', async () => {
  const correo = `${PREFIJO}rechazar@unab.cl`;
  const id = await crearUsuario(correo, 'pendiente');

  const respuesta = await request(app).post(`/api/admin/solicitudes/${id}/rechazar`).set('Authorization', admin);

  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.body.usuario.estado, 'rechazada');
  assert.equal(respuesta.body.usuario.rol, null);

  const login = await request(app).post('/api/auth/login').send({ correo, contrasena: CONTRASENA });
  assert.equal(login.status, 403);
});

test('no se puede resolver dos veces la misma solicitud', async () => {
  const id = await crearUsuario(`${PREFIJO}doble@unab.cl`, 'pendiente');
  await request(app).post(`/api/admin/solicitudes/${id}/rechazar`).set('Authorization', admin);

  const respuesta = await request(app)
    .post(`/api/admin/solicitudes/${id}/aprobar`)
    .set('Authorization', admin)
    .send({ rol: 'funcionario' });
  assert.equal(respuesta.status, 409);
});

test('no se puede asignar el rol administrador ni un rol inventado', async () => {
  const id = await crearUsuario(`${PREFIJO}rol@unab.cl`, 'pendiente');

  for (const rol of ['administrador', 'supervisor', undefined]) {
    const respuesta = await request(app)
      .post(`/api/admin/solicitudes/${id}/aprobar`)
      .set('Authorization', admin)
      .send({ rol });
    assert.equal(respuesta.status, 400, String(rol));
  }
});

test('responde 404 si la solicitud no existe y 400 si el id no es un número', async () => {
  const noExiste = await request(app).post('/api/admin/solicitudes/999999/rechazar').set('Authorization', admin);
  assert.equal(noExiste.status, 404);

  const invalido = await request(app).post('/api/admin/solicitudes/abc/rechazar').set('Authorization', admin);
  assert.equal(invalido.status, 400);
});

test('sin sesión no se puede entrar a las rutas de administración', async () => {
  const respuesta = await request(app).get('/api/admin/solicitudes');
  assert.equal(respuesta.status, 401);
});
