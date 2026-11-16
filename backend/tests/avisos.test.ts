import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';
import { autorizacion, borrarUsuarios, crearUsuario } from './ayudantes';

// S3-RES-04 (#2608): los avisos leídos se guardan en la base, no en el navegador.

const PREFIJO = 'prueba.avisos.';
let ana: string;
let beto: string;
let idAna: number;

const GRUPO = 'confirmada:2f0c4c4e-8a1d-4a53-9d3e-6a3f0f6e2b10';

test.before(async () => {
  await borrarUsuarios(PREFIJO);
  idAna = await crearUsuario(`${PREFIJO}ana@unab.cl`, 'aprobada', 'funcionario');
  ana = autorizacion(idAna);
  beto = autorizacion(await crearUsuario(`${PREFIJO}beto@unab.cl`, 'aprobada', 'conductor'));
});

test.after(async () => {
  await borrarUsuarios(PREFIJO);
  await pool.end();
});

const leidos = (sesion: string) => request(app).get('/api/avisos/leidos').set('Authorization', sesion);
const marcar = (sesion: string, ids: unknown) =>
  request(app).post('/api/avisos/leidos').set('Authorization', sesion).send({ ids });

test('sin sesión no se ven ni se marcan avisos', async () => {
  assert.equal((await request(app).get('/api/avisos/leidos')).status, 401);
  assert.equal((await request(app).post('/api/avisos/leidos').send({ ids: [GRUPO] })).status, 401);
});

test('marca avisos como leídos, sin repetirlos, y cada persona ve solo los suyos', async () => {
  assert.deepEqual((await leidos(ana)).body.leidos, []);

  const r = await marcar(ana, [GRUPO, 'cancelado:42', GRUPO]);
  assert.equal(r.status, 200);
  assert.deepEqual([...r.body.leidos].sort(), ['cancelado:42', GRUPO].sort());

  // marcar otra vez uno ya leído no lo duplica
  assert.equal((await marcar(ana, ['cancelado:42'])).body.leidos.length, 2);
  assert.deepEqual((await leidos(beto)).body.leidos, []);
});

test('rechaza listas de avisos inválidas con 400', async () => {
  const muchos = Array.from({ length: 51 }, (_, i) => `cancelado:${i}`);
  for (const ids of [undefined, [], 'cancelado:1', [1], ['<script>'], ['sin-separador'], ['x'.repeat(81)], muchos]) {
    assert.equal((await marcar(ana, ids)).status, 400, JSON.stringify(ids)?.slice(0, 40));
  }
});

test('al borrar la cuenta se borran sus avisos leídos', async () => {
  const id = await crearUsuario(`${PREFIJO}carla@unab.cl`, 'aprobada', 'funcionario');
  assert.equal((await marcar(autorizacion(id), ['en-curso:7'])).status, 200);
  await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
  const { rowCount } = await pool.query('SELECT 1 FROM avisos_leidos WHERE usuario_id = $1', [id]);
  assert.equal(rowCount, 0);
});
