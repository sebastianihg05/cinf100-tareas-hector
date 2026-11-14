import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';
import { autorizacion, borrarUsuarios, crearUsuario } from './ayudantes';

// S3-RES-02 (#2606): creación transaccional de reservas contra PostgreSQL.

const PREFIJO = 'prueba.reservas.';
let ana: string;
let beto: string;
let idAna: number;
let idBeto: number;
let admin: string;
let conductor: string;
let vanStaria: number;
let vanChica: number;
let vanBaja: number;
const viajesCreados: number[] = [];

async function limpiar() {
  await pool.query(
    `DELETE FROM reservas WHERE usuario_id IN (SELECT id FROM usuarios WHERE correo LIKE $1)`, [`${PREFIJO}%`]);
  if (viajesCreados.length > 0) {
    await pool.query('DELETE FROM reservas WHERE viaje_id = ANY($1)', [viajesCreados]);
    await pool.query('DELETE FROM viajes WHERE id = ANY($1)', [viajesCreados]);
    viajesCreados.length = 0;
  }
  await pool.query(`DELETE FROM vans WHERE patente LIKE 'RS-9%'`);
  await borrarUsuarios(PREFIJO);
}

const nuevaVan = async (patente: string, capacidad = 9, activa = true) =>
  (await pool.query('INSERT INTO vans (patente, capacidad, activa) VALUES ($1, $2, $3) RETURNING id',
    [patente, capacidad, activa])).rows[0].id as number;

test.before(async () => {
  await limpiar();
  idAna = await crearUsuario(`${PREFIJO}ana@unab.cl`, 'aprobada', 'funcionario');
  idBeto = await crearUsuario(`${PREFIJO}beto@unab.cl`, 'aprobada', 'funcionario');
  ana = autorizacion(idAna);
  beto = autorizacion(idBeto);
  admin = autorizacion(await crearUsuario(`${PREFIJO}admin@unab.cl`, 'aprobada', 'administrador'));
  conductor = autorizacion(await crearUsuario(`${PREFIJO}conductor@unab.cl`, 'aprobada', 'conductor'));
  vanStaria = await nuevaVan('RS-9001');
  vanChica = await nuevaVan('RS-9002', 4);
  vanBaja = await nuevaVan('RS-9003', 9, false);
});

test.after(async () => {
  await limpiar();
  await pool.end();
});

const RUTA = {
  Ida: { hora: '06:45', origen: 'Quillota 980', destino: 'Santiago' },
  Vuelta: { hora: '17:00', origen: 'Santiago', destino: 'Quillota 980' },
} as const;

// Días desde hoy (fecha de Chile) en los que ya hay un viaje activo de ese trayecto.
async function ocupado(dias: number, trayecto: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM viajes
      WHERE fecha = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date + $1::int
        AND trayecto = $2 AND estado <> 'cancelado'`,
    [dias, trayecto]
  );
  return (rowCount ?? 0) > 0;
}

// Busca hacia atrás desde el día 30 para no chocar con los seeds ni con las pruebas de viajes, que parten del día 2.
let siguiente = 30;
async function diaLibre(): Promise<number> {
  for (; siguiente >= 1; siguiente--) {
    if (!(await ocupado(siguiente, 'Ida')) && !(await ocupado(siguiente, 'Vuelta'))) return siguiente--;
  }
  throw new Error('no quedan días libres para la prueba');
}

async function viaje(opciones: { dias?: number; trayecto?: 'Ida' | 'Vuelta'; vanId?: number | null; estado?: string } = {}) {
  const trayecto = opciones.trayecto ?? 'Ida';
  const dias = opciones.dias ?? (await diaLibre());
  const estado = opciones.estado ?? 'pendiente';
  const { rows } = await pool.query(
    `INSERT INTO viajes (fecha, hora, trayecto, origen, destino, van_id, estado, cancelado_en)
     VALUES ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date + $1::int, $2, $3, $4, $5, $6, $7::varchar,
             CASE WHEN $7::varchar = 'cancelado' THEN CURRENT_TIMESTAMP END)
     RETURNING id`,
    [dias, RUTA[trayecto].hora, trayecto, RUTA[trayecto].origen, RUTA[trayecto].destino,
      opciones.vanId === undefined ? vanStaria : opciones.vanId, estado]
  );
  viajesCreados.push(rows[0].id);
  return { id: rows[0].id as number, dias };
}

const reservar = (sesion: string, solicitudes: unknown) =>
  request(app).post('/api/reservas').set('Authorization', sesion).send({ solicitudes });

const reservasDe = async (viajeId: number) =>
  (await pool.query('SELECT usuario_id, asiento, estado, grupo_id FROM reservas WHERE viaje_id = $1', [viajeId])).rows;

/* ---------- Acceso ---------- */

test('solo un funcionario con sesión puede reservar', async () => {
  assert.equal((await request(app).post('/api/reservas').send({ solicitudes: [] })).status, 401);
  assert.equal((await reservar(admin, [])).status, 403);
  assert.equal((await reservar(conductor, [])).status, 403);
});

/* ---------- Reservas válidas ---------- */

test('reserva un asiento de ida y queda pendiente en la base', async () => {
  const ida = await viaje();
  const r = await reservar(ana, [{ viajeId: ida.id, asiento: 3 }]);

  assert.equal(r.status, 201);
  assert.ok(r.body.grupoId);
  assert.match(r.body.reservas[0].fecha, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(r.body.reservas[0].hora, '06:45');
  assert.equal(r.body.reservas[0].asiento, 3);

  const [guardada] = await reservasDe(ida.id);
  assert.equal(guardada.usuario_id, idAna);
  assert.equal(guardada.estado, 'pendiente');
});

test('ida y vuelta del mismo día se guardan juntas, con el mismo grupo', async () => {
  const ida = await viaje();
  const vuelta = await viaje({ dias: ida.dias, trayecto: 'Vuelta' });
  const r = await reservar(ana, [{ viajeId: ida.id, asiento: 2 }, { viajeId: vuelta.id, asiento: 5 }]);

  assert.equal(r.status, 201);
  assert.equal(r.body.reservas.length, 2);
  const [enIda] = await reservasDe(ida.id);
  const [enVuelta] = await reservasDe(vuelta.id);
  assert.equal(enIda.grupo_id, r.body.grupoId);
  assert.equal(enVuelta.grupo_id, r.body.grupoId);
  assert.equal(enVuelta.asiento, 5);
});

/* ---------- Ida y vuelta inválidas ---------- */

test('ida y vuelta de días distintos se rechaza y no guarda nada', async () => {
  const ida = await viaje();
  const vuelta = await viaje({ trayecto: 'Vuelta' });
  const r = await reservar(ana, [{ viajeId: ida.id, asiento: 1 }, { viajeId: vuelta.id, asiento: 1 }]);

  assert.equal(r.status, 400);
  assert.match(r.body.error, /mismo día/);
  assert.equal((await reservasDe(ida.id)).length, 0);
  assert.equal((await reservasDe(vuelta.id)).length, 0);
});

test('dos viajes del mismo trayecto no forman una ida y vuelta', async () => {
  const una = await viaje();
  const otra = await viaje();
  assert.equal((await reservar(ana, [{ viajeId: una.id, asiento: 1 }, { viajeId: otra.id, asiento: 1 }])).status, 400);
});

/* ---------- Asientos ocupados y duplicados ---------- */

test('un asiento ocupado se rechaza con 409', async () => {
  const ida = await viaje();
  assert.equal((await reservar(ana, [{ viajeId: ida.id, asiento: 4 }])).status, 201);

  const r = await reservar(beto, [{ viajeId: ida.id, asiento: 4 }]);
  assert.equal(r.status, 409);
  assert.match(r.body.error, /otra persona/);
});

test('si la vuelta falla, la ida tampoco se guarda', async () => {
  const ida = await viaje();
  const vuelta = await viaje({ dias: ida.dias, trayecto: 'Vuelta' });
  assert.equal((await reservar(beto, [{ viajeId: vuelta.id, asiento: 6 }])).status, 201);

  const r = await reservar(ana, [{ viajeId: ida.id, asiento: 6 }, { viajeId: vuelta.id, asiento: 6 }]);
  assert.equal(r.status, 409);
  assert.equal((await reservasDe(ida.id)).length, 0);
});

test('una persona no reserva dos veces el mismo viaje', async () => {
  const ida = await viaje();
  assert.equal((await reservar(ana, [{ viajeId: ida.id, asiento: 1 }])).status, 201);

  const r = await reservar(ana, [{ viajeId: ida.id, asiento: 2 }]);
  assert.equal(r.status, 409);
  assert.match(r.body.error, /Ya tienes una reserva/);
});

test('dos personas que piden el mismo asiento a la vez: solo una lo consigue', async () => {
  const ida = await viaje();
  const respuestas = await Promise.all([
    reservar(ana, [{ viajeId: ida.id, asiento: 7 }]),
    reservar(beto, [{ viajeId: ida.id, asiento: 7 }]),
  ]);

  assert.deepEqual(respuestas.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await reservasDe(ida.id)).length, 1);
});

/* ---------- Datos inválidos ---------- */

test('rechaza solicitudes vacías, mal formadas o con más de dos trayectos', async () => {
  const ida = await viaje();
  for (const solicitudes of [undefined, [], [null], [{ viajeId: ida.id, asiento: '3' }], [{ viajeId: 'x', asiento: 3 }],
    [{ viajeId: ida.id, asiento: 1 }, { viajeId: ida.id, asiento: 2 }],
    [{ viajeId: 1, asiento: 1 }, { viajeId: 2, asiento: 1 }, { viajeId: 3, asiento: 1 }]]) {
    assert.equal((await reservar(ana, solicitudes)).status, 400, JSON.stringify(solicitudes));
  }
  assert.equal((await reservasDe(ida.id)).length, 0);
});

test('el asiento debe existir en la van del viaje', async () => {
  const ida = await viaje({ vanId: vanChica });
  assert.equal((await reservar(ana, [{ viajeId: ida.id, asiento: 5 }])).status, 400);
  assert.equal((await reservar(ana, [{ viajeId: ida.id, asiento: 0 }])).status, 400);
  assert.equal((await reservar(ana, [{ viajeId: ida.id, asiento: 4 }])).status, 201);
});

/* ---------- Viajes no disponibles ---------- */

test('un viaje inexistente responde 404', async () => {
  assert.equal((await reservar(ana, [{ viajeId: 999999999, asiento: 1 }])).status, 404);
});

test('no se reserva en un viaje cancelado, sin van o con la van dada de baja', async () => {
  const cancelado = await viaje({ estado: 'cancelado' });
  const sinVan = await viaje({ vanId: null });
  const conVanBaja = await viaje({ vanId: vanBaja });
  for (const v of [cancelado, sinVan, conVanBaja]) {
    assert.equal((await reservar(ana, [{ viajeId: v.id, asiento: 1 }])).status, 409);
  }
});

test('solo se reserva con 1 a 30 días de anticipación', async () => {
  for (const dias of [0, 31]) {
    if (await ocupado(dias, 'Ida')) continue;
    const v = await viaje({ dias });
    const r = await reservar(ana, [{ viajeId: v.id, asiento: 1 }]);
    assert.equal(r.status, 409, `día ${dias}`);
    assert.match(r.body.error, /anticipación/);
  }
});
