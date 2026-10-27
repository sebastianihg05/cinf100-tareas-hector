import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';
import { verificarContrasena } from '../src/usuarios/contrasenas';

// Correos exclusivos de esta prueba; se borran al terminar.
const PREFIJO = 'prueba.registro.';

const solicitud = {
  nombreCompleto: 'Ana Pérez',
  correo: `${PREFIJO}ana@unab.cl`,
  contrasena: 'Segura.2026',
  confirmacion: 'Segura.2026',
  telefono: '+56 9 1234 5678',
  sede: 'Quillota 980',
};

async function limpiar() {
  await pool.query('DELETE FROM usuarios WHERE correo LIKE $1', [`${PREFIJO}%`]);
}

test.before(limpiar);

test.after(async () => {
  await limpiar();
  await pool.end();
});

test('registra la cuenta como pendiente y sin rol', async () => {
  const respuesta = await request(app).post('/api/auth/registro').send(solicitud);

  assert.equal(respuesta.status, 201);
  assert.equal(respuesta.body.usuario.estado, 'pendiente');
  assert.equal(respuesta.body.usuario.rol, null);
  assert.ok(!JSON.stringify(respuesta.body).includes('hash'));

  const { rows } = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [solicitud.correo]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].rol, null);
  assert.equal(rows[0].telefono, '+56912345678');
  assert.notEqual(rows[0].hash_contrasena, solicitud.contrasena);
  assert.ok(await verificarContrasena(solicitud.contrasena, rows[0].hash_contrasena));
});

test('rechaza un correo ya registrado, aunque cambien las mayúsculas', async () => {
  const respuesta = await request(app)
    .post('/api/auth/registro')
    .send({ ...solicitud, correo: solicitud.correo.toUpperCase() });

  assert.equal(respuesta.status, 409);
  assert.ok(respuesta.body.errores.correo);
});

test('ignora el rol y el estado que envíe el cliente', async () => {
  const correo = `${PREFIJO}intruso@unab.cl`;
  const respuesta = await request(app)
    .post('/api/auth/registro')
    .send({ ...solicitud, correo, rol: 'administrador', estado_aprobacion: 'aprobada' });

  assert.equal(respuesta.status, 201);
  const { rows } = await pool.query('SELECT rol, estado_aprobacion FROM usuarios WHERE correo = $1', [correo]);
  assert.equal(rows[0].rol, null);
  assert.equal(rows[0].estado_aprobacion, 'pendiente');
});

test('rechaza datos inválidos con 400 y no guarda nada', async () => {
  const correo = `${PREFIJO}invalido@gmail.com`;
  const respuesta = await request(app)
    .post('/api/auth/registro')
    .send({ ...solicitud, correo, contrasena: 'corta', confirmacion: 'otra' });

  assert.equal(respuesta.status, 400);
  assert.ok(respuesta.body.errores.correo);
  assert.ok(respuesta.body.errores.contrasena);

  const { rowCount } = await pool.query('SELECT 1 FROM usuarios WHERE correo = $1', [correo]);
  assert.equal(rowCount, 0);
});

test('responde 400 si el cuerpo no es JSON válido', async () => {
  const respuesta = await request(app)
    .post('/api/auth/registro')
    .set('Content-Type', 'application/json')
    .send('{no es json');

  assert.equal(respuesta.status, 400);
});