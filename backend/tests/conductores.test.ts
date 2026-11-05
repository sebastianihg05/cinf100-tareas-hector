import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app';
import { formatearRut } from '../src/admin/conductores';
import { pool } from '../src/db';
import { autorizacion, borrarUsuarios, crearUsuario } from './ayudantes';

const PREFIJO = 'prueba.conductores.';
let admin: string;

test.before(async () => {
  await borrarUsuarios(PREFIJO);
  admin = autorizacion(await crearUsuario(`${PREFIJO}admin@unab.cl`, 'aprobada', 'administrador'));
});

test.after(async () => {
  await borrarUsuarios(PREFIJO);
  await pool.end();
});

// Crea una solicitud y la aprueba con el rol indicado, como lo hace el administrador.
async function aprobar(nombre: string, rol: 'conductor' | 'funcionario'): Promise<number> {
  const id = await crearUsuario(`${PREFIJO}${nombre}@unab.cl`, 'pendiente');
  const respuesta = await request(app)
    .post(`/api/admin/solicitudes/${id}/aprobar`)
    .set('Authorization', admin)
    .send({ rol });
  assert.equal(respuesta.status, 200);
  return id;
}

async function listar() {
  const respuesta = await request(app).get('/api/admin/conductores').set('Authorization', admin);
  assert.equal(respuesta.status, 200);
  return respuesta.body.conductores as { id: number; rut: string | null; licenciaHasta: string | null; activo: boolean }[];
}

test('al aprobar una cuenta como conductor queda registrada en conductores, sin RUT ni licencia', async () => {
  const id = await aprobar('nuevo', 'conductor');

  const conductor = (await listar()).find((c) => c.id === id);
  assert.ok(conductor);
  assert.equal(conductor.rut, null);
  assert.equal(conductor.licenciaHasta, null);
  assert.equal(conductor.activo, true);
});

test('al aprobar como funcionario no se crea un conductor', async () => {
  const id = await aprobar('funcionario', 'funcionario');
  assert.equal((await listar()).some((c) => c.id === id), false);
});

test('el administrador guarda el RUT y la licencia en la base', async () => {
  const id = await aprobar('datos', 'conductor');

  const respuesta = await request(app)
    .patch(`/api/admin/conductores/${id}`)
    .set('Authorization', admin)
    .send({ rut: '11111111-1', licenciaHasta: '2028-03-15' });

  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.body.conductor.rut, '11.111.111-1');
  assert.equal(respuesta.body.conductor.licenciaHasta, '2028-03-15');

  const guardado = (await listar()).find((c) => c.id === id);
  assert.equal(guardado?.rut, '11.111.111-1');
  assert.equal(guardado?.licenciaHasta, '2028-03-15');
});

test('dar de baja y reactivar un conductor queda guardado', async () => {
  const id = await aprobar('baja', 'conductor');

  const baja = await request(app).patch(`/api/admin/conductores/${id}`).set('Authorization', admin).send({ activo: false });
  assert.equal(baja.status, 200);
  assert.equal((await listar()).find((c) => c.id === id)?.activo, false);

  await request(app).patch(`/api/admin/conductores/${id}`).set('Authorization', admin).send({ activo: true });
  assert.equal((await listar()).find((c) => c.id === id)?.activo, true);
});

test('rechaza RUT, fecha o activo inválidos', async () => {
  const id = await aprobar('invalido', 'conductor');

  for (const cuerpo of [{ rut: '12345' }, { rut: 'abc' }, { licenciaHasta: '2028-02-30' }, { activo: 'si' }, {}]) {
    const respuesta = await request(app).patch(`/api/admin/conductores/${id}`).set('Authorization', admin).send(cuerpo);
    assert.equal(respuesta.status, 400, JSON.stringify(cuerpo));
  }
});

test('el RUT se edita libremente: basta con que tenga forma de RUT', async () => {
  const id = await aprobar('rutlibre', 'conductor');
  const enviar = (rut: string) =>
    request(app).patch(`/api/admin/conductores/${id}`).set('Authorization', admin).send({ rut });

  // el dígito verificador no se revisa
  const libre = await enviar('12.987.987-6');
  assert.equal(libre.status, 200);
  assert.equal(libre.body.conductor.rut, '12.987.987-6');

  const otro = await enviar('129879874');
  assert.equal(otro.status, 200);
  assert.equal(otro.body.conductor.rut, '12.987.987-4');

  const conK = await enviar('10000013k');
  assert.equal(conK.status, 200);
  assert.equal(conK.body.conductor.rut, '10.000.013-K');

  const malFormato = await enviar('12345');
  assert.equal(malFormato.status, 400);
  assert.match(malFormato.body.errores.rut, /RUT inválido/);
});

test('no se puede repetir el RUT de otro conductor', async () => {
  const primero = await aprobar('rut1', 'conductor');
  const segundo = await aprobar('rut2', 'conductor');
  await request(app).patch(`/api/admin/conductores/${primero}`).set('Authorization', admin).send({ rut: '22.222.222-2' });

  const respuesta = await request(app)
    .patch(`/api/admin/conductores/${segundo}`)
    .set('Authorization', admin)
    .send({ rut: '22222222-2' });
  assert.equal(respuesta.status, 409);
});

test('responde 404 si el conductor no existe y 400 si el id no es un número', async () => {
  const noExiste = await request(app).patch('/api/admin/conductores/999999').set('Authorization', admin).send({ activo: true });
  assert.equal(noExiste.status, 404);

  const invalido = await request(app).patch('/api/admin/conductores/abc').set('Authorization', admin).send({ activo: true });
  assert.equal(invalido.status, 400);
});

test('un conductor no puede ver ni editar la lista de conductores', async () => {
  const id = await aprobar('sinpermiso', 'conductor');
  const conductor = autorizacion(id);

  assert.equal((await request(app).get('/api/admin/conductores').set('Authorization', conductor)).status, 403);
  assert.equal((await request(app).get('/api/admin/conductores')).status, 401);
});

test('formatearRut agrega puntos y guion sin revisar el dígito verificador', () => {
  assert.equal(formatearRut('13987654-7'), '13.987.654-7');
  assert.equal(formatearRut('1.234.567-4'), '1.234.567-4');
  assert.equal(formatearRut('13987654-8'), '13.987.654-8');
  assert.equal(formatearRut('12345'), null);
  assert.equal(formatearRut('abc'), null);
});
