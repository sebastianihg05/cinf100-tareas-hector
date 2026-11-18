
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';
import { crearUsuario, autorizacion, borrarUsuarios } from './ayudantes';

const prefijo = 'prueba.vans.';
const patentesPrueba = ['ZZ-9876', 'ZY-9876', 'ZX-9876', 'ZW-9876'];

let adminId: number;
let conductorId: number;
let otroConductorId: number;
let admin: string;
let vanId: string;

async function limpiarVansPrueba() {
  await pool.query(
    'DELETE FROM vans WHERE patente = ANY($1::varchar[])',
    [patentesPrueba]
  );
}

before(async () => {
  await limpiarVansPrueba();
  await borrarUsuarios(prefijo);

  adminId = await crearUsuario(
    `${prefijo}admin@unab.cl`,
    'aprobada',
    'administrador'
  );

  admin = autorizacion(adminId);

  conductorId = await crearUsuario(
    `${prefijo}conductor@unab.cl`,
    'pendiente'
  );

  otroConductorId = await crearUsuario(
    `${prefijo}conductor2@unab.cl`,
    'pendiente'
  );

  const aprobarConductor = async (id: number) => {
    const respuesta = await request(app)
      .post(`/api/admin/solicitudes/${id}/aprobar`)
      .set('Authorization', admin)
      .send({ rol: 'conductor' });

    assert.equal(
      respuesta.status,
      200,
      `Error al aprobar conductor ${id}: ${JSON.stringify(respuesta.body)}`
    );
  };

  await aprobarConductor(conductorId);
  await aprobarConductor(otroConductorId);
});

after(async () => {
  await limpiarVansPrueba();
  await borrarUsuarios(prefijo);
  await pool.end();
});

test('rechaza el acceso a vans sin autorización administrativa', async () => {
  const respuesta = await request(app).get('/api/admin/vans');

  assert.ok([401, 403].includes(respuesta.status));
});

test('permite al administrador consultar las vans', async () => {
  const respuesta = await request(app)
    .get('/api/admin/vans')
    .set('Authorization', admin);

  assert.equal(respuesta.status, 200);
  assert.ok(Array.isArray(respuesta.body.vans));
});

test('rechaza una patente con formato inválido', async () => {
  const respuesta = await request(app)
    .post('/api/admin/vans')
    .set('Authorization', admin)
    .send({ patente: 'INVALIDA' });

  assert.equal(respuesta.status, 400);
});

test('crea una van y permite modificarla', async () => {
  const creada = await request(app)
    .post('/api/admin/vans')
    .set('Authorization', admin)
    .send({
      patente: 'ZZ-9876',
      conductorId
    });

  assert.equal(
    creada.status,
    201,
    `No se pudo crear la van: ${JSON.stringify(creada.body)}`
  );

  vanId = creada.body.van.id;

  assert.equal(creada.body.van.patente, 'ZZ-9876');
  assert.equal(creada.body.van.conductorId, conductorId);

  const modificada = await request(app)
    .patch(`/api/admin/vans/${vanId}`)
    .set('Authorization', admin)
    .send({ patente: 'ZY-9876' });

  assert.equal(
    modificada.status,
    200,
    `No se pudo modificar la van: ${JSON.stringify(modificada.body)}`
  );

  assert.equal(modificada.body.van.patente, 'ZY-9876');
});

test('impide registrar una patente duplicada', async () => {
  const respuesta = await request(app)
    .post('/api/admin/vans')
    .set('Authorization', admin)
    .send({ patente: 'ZY-9876' });

  assert.equal(respuesta.status, 409);
});

test('impide asignar un conductor que ya tiene una van', async () => {
  const respuesta = await request(app)
    .post('/api/admin/vans')
    .set('Authorization', admin)
    .send({
      patente: 'ZX-9876',
      conductorId
    });

  assert.equal(respuesta.status, 409);
});

test('permite desactivar una van y libera su conductor', async () => {
  const respuesta = await request(app)
    .patch(`/api/admin/vans/${vanId}`)
    .set('Authorization', admin)
    .send({ activa: false });

  assert.equal(
    respuesta.status,
    200,
    `No se pudo desactivar la van: ${JSON.stringify(respuesta.body)}`
  );

  assert.equal(respuesta.body.van.activa, false);
  assert.equal(respuesta.body.van.conductorId, null);
});

test('permite asignar el conductor liberado a otra van', async () => {
  const respuesta = await request(app)
    .post('/api/admin/vans')
    .set('Authorization', admin)
    .send({
      patente: 'ZX-9876',
      conductorId
    });

  assert.equal(
    respuesta.status,
    201,
    `No se pudo reasignar el conductor: ${JSON.stringify(respuesta.body)}`
  );
});

test('no asigna un conductor sin registro válido y explica el motivo', async () => {
  const funcionario = await crearUsuario(`${prefijo}funcionario@unab.cl`, 'aprobada', 'funcionario');
  for (const id of [funcionario, 999999]) {
    const respuesta = await request(app)
      .post('/api/admin/vans')
      .set('Authorization', admin)
      .send({ patente: 'ZW-9876', conductorId: id });
    assert.equal(respuesta.status, 400, JSON.stringify(respuesta.body));
    assert.match(respuesta.body.error, /todavía no está registrado/);
  }
});

test('no asigna un conductor dado de baja (antes respondía error interno)', async () => {
  await pool.query('UPDATE conductores SET activo = false WHERE usuario_id = $1', [otroConductorId]);
  const respuesta = await request(app)
    .post('/api/admin/vans')
    .set('Authorization', admin)
    .send({ patente: 'ZW-9876', conductorId: otroConductorId });
  await pool.query('UPDATE conductores SET activo = true WHERE usuario_id = $1', [otroConductorId]);
  assert.equal(respuesta.status, 400);
  assert.match(respuesta.body.error, /dado de baja/);
});

test('una cuenta conductor aprobada sin fila en conductores se registra al listar y se puede asignar', async () => {
  // cuenta cargada fuera de la aprobación (seed, Adminer): rol conductor, pero sin fila en conductores
  const id = await crearUsuario(`${prefijo}sin-registro@unab.cl`, 'aprobada', 'conductor');
  const lista = await request(app).get('/api/admin/conductores').set('Authorization', admin);
  assert.ok(lista.body.conductores.some((c: { id: number }) => c.id === id));

  const respuesta = await request(app)
    .post('/api/admin/vans')
    .set('Authorization', admin)
    .send({ patente: 'ZW-9876', conductorId: id });
  assert.equal(respuesta.status, 201, JSON.stringify(respuesta.body));
  const { rows } = await pool.query('SELECT conductor_id FROM vans WHERE patente = $1', ['ZW-9876']);
  assert.equal(rows[0].conductor_id, id);
});
