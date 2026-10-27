import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';
import { borrarUsuarios, CONTRASENA, crearUsuario } from './ayudantes';

const PREFIJO = 'prueba.login.';

test.before(async () => {
  await borrarUsuarios(PREFIJO);
  await crearUsuario(`${PREFIJO}aprobado@unab.cl`, 'aprobada', 'funcionario');
  await crearUsuario(`${PREFIJO}pendiente@unab.cl`, 'pendiente');
  await crearUsuario(`${PREFIJO}rechazado@unab.cl`, 'rechazada');
  await crearUsuario(`${PREFIJO}desactivado@unab.cl`, 'desactivada', 'funcionario');
});

test.after(async () => {
  await borrarUsuarios(PREFIJO);
  await pool.end();
});

function login(correo: string, contrasena = CONTRASENA) {
  return request(app).post('/api/auth/login').send({ correo, contrasena });
}

test('una cuenta aprobada inicia sesión y recibe un token', async () => {
  const respuesta = await login(`${PREFIJO}aprobado@unab.cl`);

  assert.equal(respuesta.status, 200);
  assert.match(respuesta.body.token, /^[\w-]+\.[\w-]+\.[\w-]+$/);
  assert.equal(respuesta.body.usuario.rol, 'funcionario');
  assert.ok(respuesta.body.usuario.ultimoIngresoEn);
  assert.ok(!JSON.stringify(respuesta.body).includes('hash'));
});

test('acepta el correo con mayúsculas y espacios', async () => {
  const respuesta = await login(`  ${PREFIJO}APROBADO@UNAB.CL `);
  assert.equal(respuesta.status, 200);
});

test('rechaza una contraseña incorrecta', async () => {
  const respuesta = await login(`${PREFIJO}aprobado@unab.cl`, 'Incorrecta.2026');

  assert.equal(respuesta.status, 401);
  assert.equal(respuesta.body.error, 'Correo o contraseña incorrectos.');
  assert.equal(respuesta.body.token, undefined);
});

test('un correo que no existe recibe el mismo mensaje', async () => {
  const respuesta = await login(`${PREFIJO}no-existe@unab.cl`);

  assert.equal(respuesta.status, 401);
  assert.equal(respuesta.body.error, 'Correo o contraseña incorrectos.');
});

test('bloquea cuentas pendientes, rechazadas y desactivadas', async () => {
  const cuentas = { pendiente: 'pendiente', rechazada: 'rechazado', desactivada: 'desactivado' };

  for (const [estado, nombre] of Object.entries(cuentas)) {
    const respuesta = await login(`${PREFIJO}${nombre}@unab.cl`);

    assert.equal(respuesta.status, 403, estado);
    assert.equal(respuesta.body.estado, estado);
    assert.equal(respuesta.body.token, undefined);
  }
});

test('una cuenta bloqueada con contraseña incorrecta no revela su estado', async () => {
  const respuesta = await login(`${PREFIJO}pendiente@unab.cl`, 'Incorrecta.2026');

  assert.equal(respuesta.status, 401);
  assert.equal(respuesta.body.estado, undefined);
});

test('exige correo y contraseña', async () => {
  const respuesta = await request(app).post('/api/auth/login').send({});
  assert.equal(respuesta.status, 400);
});