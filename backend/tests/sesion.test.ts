import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../src/app';
import { config } from '../src/config';
import { pool } from '../src/db';
import { autorizacion, borrarUsuarios, crearUsuario } from './ayudantes';

const PREFIJO = 'prueba.sesion.';
let idFuncionario: number;

test.before(async () => {
  await borrarUsuarios(PREFIJO);
  idFuncionario = await crearUsuario(`${PREFIJO}funcionario@unab.cl`, 'aprobada', 'funcionario');
});

test.after(async () => {
  await borrarUsuarios(PREFIJO);
  await pool.end();
});

test('sin token responde 401', async () => {
  const respuesta = await request(app).get('/api/usuarios/me');
  assert.equal(respuesta.status, 401);
});

test('un token inválido responde 401', async () => {
  const respuesta = await request(app).get('/api/usuarios/me').set('Authorization', 'Bearer abc.def.ghi');
  assert.equal(respuesta.status, 401);
});

test('un token firmado con otra clave responde 401', async () => {
  const falso = jwt.sign({}, 'otra-clave', { subject: String(idFuncionario) });
  const respuesta = await request(app).get('/api/usuarios/me').set('Authorization', `Bearer ${falso}`);
  assert.equal(respuesta.status, 401);
});

test('un token vencido responde 401 y lo dice', async () => {
  const vencido = jwt.sign(
    { exp: Math.floor(Date.now() / 1000) - 60 },
    config.jwtSecret,
    { subject: String(idFuncionario) }
  );
  const respuesta = await request(app).get('/api/usuarios/me').set('Authorization', `Bearer ${vencido}`);

  assert.equal(respuesta.status, 401);
  assert.match(respuesta.body.error, /expiró/);
});

test('con token válido devuelve el perfil propio', async () => {
  const respuesta = await request(app).get('/api/usuarios/me').set('Authorization', autorizacion(idFuncionario));

  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.body.usuario.id, idFuncionario);
  assert.equal(respuesta.body.usuario.rol, 'funcionario');
});

test('el usuario puede cambiar su celular', async () => {
  const respuesta = await request(app)
    .patch('/api/usuarios/me')
    .set('Authorization', autorizacion(idFuncionario))
    .send({ telefono: '9 8765 4321' });

  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.body.usuario.telefono, '+56987654321');
});

test('rechaza un celular inválido', async () => {
  const respuesta = await request(app)
    .patch('/api/usuarios/me')
    .set('Authorization', autorizacion(idFuncionario))
    .send({ telefono: '123' });

  assert.equal(respuesta.status, 400);
});

test('un funcionario no puede entrar a las rutas de administración', async () => {
  const respuesta = await request(app).get('/api/admin/solicitudes').set('Authorization', autorizacion(idFuncionario));
  assert.equal(respuesta.status, 403);
});

test('si la cuenta se desactiva, su token deja de servir de inmediato', async () => {
  const id = await crearUsuario(`${PREFIJO}desactivar@unab.cl`, 'aprobada', 'funcionario');
  const token = autorizacion(id);
  await pool.query("UPDATE usuarios SET estado_aprobacion = 'desactivada' WHERE id = $1", [id]);

  const respuesta = await request(app).get('/api/usuarios/me').set('Authorization', token);
  assert.equal(respuesta.status, 403);
});
