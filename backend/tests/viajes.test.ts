import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app';
import { config } from '../src/config';
import { pool } from '../src/db';
import { configurarProveedor, INTERVALO_MIN_MS } from '../src/viajes/rutas-mapa';
import { autorizacion, borrarUsuarios, crearUsuario } from './ayudantes';

const PREFIJO = 'prueba.viajes.';
let admin: string;
let idAdmin: number;
let conductor: string;
let otroConductor: string;
let funcionario: string;
let idConductor: number;
let idOtro: number;
let idFuncionario: number;

// Fecha dentro de la ventana de 1 a 30 días, según el día de Chile (igual que el backend).
function fechaEn(dias: number): string {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Cada prueba usa un día sin viajes activos (el seed de desarrollo ya ocupa algunos): el índice único de
// (fecha, trayecto) no deja repetir un viaje activo.
let proximoDia = 2;
async function diaNuevo(): Promise<string> {
  for (;;) {
    const fecha = fechaEn(proximoDia++);
    assert.ok(proximoDia <= DIAS_MAX + 2, 'no quedan días libres para la prueba');
    const { rowCount } = await pool.query(`SELECT 1 FROM viajes WHERE fecha = $1 AND estado <> 'cancelado'`, [fecha]);
    if (!rowCount) return fecha;
  }
}
const DIAS_MAX = 30;

// Vans de prueba: cada número es una van real (patente ZP-9xxx) que se crea la primera vez que se usa.
// La llave viajes.van_id (006_vans.sql) no acepta vans que no existen.
const vans = new Map<number, number>();
async function van(numero: number): Promise<number> {
  const guardada = vans.get(numero);
  if (guardada) return guardada;
  const patente = `ZP-9${String(numero).padStart(3, '0')}`;
  const { rows } = await pool.query('INSERT INTO vans (patente) VALUES ($1) RETURNING id', [patente]);
  vans.set(numero, rows[0].id);
  return rows[0].id;
}

async function limpiar() {
  await pool.query(
    `DELETE FROM reservas WHERE usuario_id IN (SELECT id FROM usuarios WHERE correo LIKE $1)`, [`${PREFIJO}%`]);
  await pool.query(`DELETE FROM viajes WHERE creado_por IN (SELECT id FROM usuarios WHERE correo LIKE $1)
                     OR conductor_id IN (SELECT id FROM usuarios WHERE correo LIKE $1)`, [`${PREFIJO}%`]);
  await pool.query(`DELETE FROM vans WHERE patente LIKE 'ZP-9%'`);
  vans.clear();
  await borrarUsuarios(PREFIJO);
}

test.before(async () => {
  await limpiar();
  idAdmin = await crearUsuario(`${PREFIJO}admin@unab.cl`, 'aprobada', 'administrador');
  admin = autorizacion(idAdmin);
  idConductor = await crearUsuario(`${PREFIJO}conductor@unab.cl`, 'aprobada', 'conductor');
  idOtro = await crearUsuario(`${PREFIJO}otro@unab.cl`, 'aprobada', 'conductor');
  idFuncionario = await crearUsuario(`${PREFIJO}funcionario@unab.cl`, 'aprobada', 'funcionario');
  await pool.query('INSERT INTO conductores (usuario_id) VALUES ($1), ($2)', [idConductor, idOtro]);
  conductor = autorizacion(idConductor);
  otroConductor = autorizacion(idOtro);
  funcionario = autorizacion(idFuncionario);
});

test.after(async () => {
  await limpiar();
  await pool.end();
});

async function abrir(trayectos: string[], fecha?: string) {
  fecha ??= await diaNuevo();
  const respuesta = await request(app).post('/api/admin/viajes').set('Authorization', admin).send({ fecha, trayectos });
  return { respuesta, fecha };
}

// Abre un viaje de ida y le asigna van y conductor.
async function viajeAsignado(conductorId = idConductor, numeroVan = 7): Promise<number> {
  const vanId = await van(numeroVan);
  const { respuesta } = await abrir(['Ida']);
  assert.equal(respuesta.status, 201);
  const id = respuesta.body.viajes[0].id as number;
  const asignado = await request(app).patch(`/api/admin/viajes/${id}`).set('Authorization', admin).send({ vanId, conductorId });
  assert.equal(asignado.status, 200);
  return id;
}

async function reservar(viajeId: number, asiento: number) {
  await pool.query(
    `INSERT INTO reservas (grupo_id, usuario_id, viaje_id, asiento) VALUES (gen_random_uuid(), $1, $2, $3)`,
    [idFuncionario, viajeId, asiento]
  );
}

/* ---------- Administración ---------- */

test('solo el administrador accede a los viajes de la administración', async () => {
  assert.equal((await request(app).get('/api/admin/viajes')).status, 401);
  assert.equal((await request(app).get('/api/admin/viajes').set('Authorization', funcionario)).status, 403);
  assert.equal((await request(app).get('/api/admin/viajes').set('Authorization', conductor)).status, 403);
});

test('el administrador abre ida y vuelta con la ruta y el horario fijos', async () => {
  const { respuesta, fecha } = await abrir(['Ida', 'Vuelta']);

  assert.equal(respuesta.status, 201);
  const [ida, vuelta] = respuesta.body.viajes;
  assert.deepEqual(
    [ida.trayecto, ida.origen, ida.destino, ida.hora, ida.fecha, ida.estado],
    ['Ida', 'Quillota 980', 'Santiago', '06:45', fecha, 'pendiente']
  );
  assert.deepEqual([vuelta.trayecto, vuelta.origen, vuelta.destino, vuelta.hora], ['Vuelta', 'Santiago', 'Quillota 980', '17:00']);
  assert.equal(ida.vanId, null);
  assert.equal(ida.conductorId, null);
  assert.deepEqual(ida.reservas, []);

  const lista = await request(app).get('/api/admin/viajes').set('Authorization', admin);
  const ids = lista.body.viajes.map((v: { id: number }) => v.id);
  assert.ok(ids.includes(ida.id) && ids.includes(vuelta.id));
});

test('no se abre un viaje con fecha inválida, fuera de rango o sin trayecto', async () => {
  for (const cuerpo of [
    { fecha: 'mañana', trayectos: ['Ida'] },
    { fecha: fechaEn(0), trayectos: ['Ida'] },
    { fecha: fechaEn(31), trayectos: ['Ida'] },
    { fecha: fechaEn(5), trayectos: [] },
    { fecha: fechaEn(5), trayectos: ['Ida', 'Ida'] },
    { fecha: fechaEn(5), trayectos: ['Regreso'] },
  ]) {
    const r = await request(app).post('/api/admin/viajes').set('Authorization', admin).send(cuerpo);
    assert.equal(r.status, 400, JSON.stringify(cuerpo));
  }
});

test('no se abre dos veces el mismo trayecto el mismo día y no queda ninguno a medias', async () => {
  const fecha = await diaNuevo();
  assert.equal((await abrir(['Ida'], fecha)).respuesta.status, 201);

  const repetido = await abrir(['Ida', 'Vuelta'], fecha);
  assert.equal(repetido.respuesta.status, 409);
  assert.match(repetido.respuesta.body.error, /Ya hay un viaje abierto/);

  const lista = await request(app).get('/api/admin/viajes').set('Authorization', admin);
  const delDia = lista.body.viajes.filter((v: { fecha: string }) => v.fecha === fecha);
  assert.equal(delDia.length, 1, 'la vuelta no debe haberse guardado');
});

test('la asignación de van y conductor queda guardada', async () => {
  const id = await viajeAsignado(idConductor, 3);

  const lista = await request(app).get('/api/admin/viajes').set('Authorization', admin);
  const viaje = lista.body.viajes.find((v: { id: number }) => v.id === id);
  assert.equal(viaje.vanId, await van(3));
  assert.equal(viaje.conductorId, idConductor);
});

test('no se asigna un conductor inexistente, inactivo o que no es conductor', async () => {
  const { respuesta } = await abrir(['Ida']);
  const id = respuesta.body.viajes[0].id;
  const vanId = await van(1);
  const asignar = (conductorId: number) =>
    request(app).patch(`/api/admin/viajes/${id}`).set('Authorization', admin).send({ vanId, conductorId });

  assert.equal((await asignar(999999)).status, 400);
  assert.equal((await asignar(idFuncionario)).status, 400);

  await pool.query('UPDATE conductores SET activo = false WHERE usuario_id = $1', [idOtro]);
  assert.equal((await asignar(idOtro)).status, 400);
  await pool.query('UPDATE conductores SET activo = true WHERE usuario_id = $1', [idOtro]);
});

test('no se asigna una van inexistente ni una dada de baja', async () => {
  const { respuesta } = await abrir(['Ida']);
  const id = respuesta.body.viajes[0].id;
  const asignar = (vanId: number) =>
    request(app).patch(`/api/admin/viajes/${id}`).set('Authorization', admin).send({ vanId, conductorId: idConductor });

  const sinVan = await asignar(999999);
  assert.equal(sinVan.status, 400);
  assert.ok(sinVan.body.errores.vanId);

  const baja = await van(2);
  await pool.query('UPDATE vans SET activa = false WHERE id = $1', [baja]);
  assert.equal((await asignar(baja)).status, 400);
});

test('la administración cancela un viaje pendiente y sus reservas se cancelan', async () => {
  const id = await viajeAsignado();
  await reservar(id, 2);

  const r = await request(app).patch(`/api/admin/viajes/${id}`).set('Authorization', admin).send({ estado: 'cancelado' });
  assert.equal(r.status, 200);
  assert.equal(r.body.viaje.estado, 'cancelado');
  assert.ok(r.body.viaje.canceladoEn);
  assert.equal(r.body.viaje.reservas[0].estado, 'cancelada');

  // un viaje cancelado ya no se modifica
  const otra = await request(app).patch(`/api/admin/viajes/${id}`).set('Authorization', admin).send({ estado: 'cancelado' });
  assert.equal(otra.status, 409);
});

test('la administración solo cancela: no inicia ni completa viajes', async () => {
  const id = await viajeAsignado();
  for (const estado of ['en-curso', 'completado']) {
    const r = await request(app).patch(`/api/admin/viajes/${id}`).set('Authorization', admin).send({ estado });
    assert.equal(r.status, 400);
  }
  const ambos = await request(app).patch(`/api/admin/viajes/${id}`).set('Authorization', admin)
    .send({ estado: 'cancelado', vanId: await van(1) });
  assert.equal(ambos.status, 400);
});

test('un viaje inexistente responde 404 y un id inválido 400', async () => {
  const sinViaje = await request(app).patch('/api/admin/viajes/999999').set('Authorization', admin).send({ estado: 'cancelado' });
  assert.equal(sinViaje.status, 404);
  const malId = await request(app).patch('/api/admin/viajes/abc').set('Authorization', admin).send({ estado: 'cancelado' });
  assert.equal(malId.status, 400);
});

/* ---------- Panel del conductor ---------- */

test('solo un conductor accede a las rutas del conductor', async () => {
  assert.equal((await request(app).get('/api/conductor/viajes')).status, 401);
  assert.equal((await request(app).get('/api/conductor/viajes').set('Authorization', funcionario)).status, 403);
  assert.equal((await request(app).get('/api/conductor/viajes').set('Authorization', admin)).status, 403);
});

test('el conductor ve solo sus viajes, con los pasajeros de cada uno', async () => {
  const propio = await viajeAsignado(idConductor);
  const ajeno = await viajeAsignado(idOtro, 8);
  await reservar(propio, 4);

  const r = await request(app).get('/api/conductor/viajes').set('Authorization', conductor);
  assert.equal(r.status, 200);
  const ids = r.body.viajes.map((v: { id: number }) => v.id);
  assert.ok(ids.includes(propio));
  assert.ok(!ids.includes(ajeno));

  const viaje = r.body.viajes.find((v: { id: number }) => v.id === propio);
  assert.equal(viaje.reservas.length, 1);
  assert.equal(viaje.reservas[0].asiento, 4);
  assert.equal(viaje.reservas[0].nombre, 'Usuario de prueba');
  assert.equal(viaje.reservas[0].telefono, '+56911112222');
});

// Comprueba el detalle individual, sus pasajeros y la protección frente a viajes ajenos.
test('el conductor consulta el detalle de sus viajes y no puede consultar viajes ajenos', async () => {
  const propio = await viajeAsignado(idConductor, 71);
  const ajeno = await viajeAsignado(idOtro, 72);
  await reservar(propio, 5);

  const detalle = await request(app)
    .get(`/api/conductor/viajes/${propio}`)
    .set('Authorization', conductor);

  assert.equal(detalle.status, 200);
  assert.equal(detalle.body.viaje.id, propio);
  assert.equal(detalle.body.viaje.origen, 'Quillota 980');
  assert.equal(detalle.body.viaje.destino, 'Santiago');
  assert.equal(detalle.body.viaje.reservas.length, 1);
  assert.equal(detalle.body.viaje.reservas[0].asiento, 5);

  const prohibido = await request(app)
    .get(`/api/conductor/viajes/${ajeno}`)
    .set('Authorization', conductor);

  assert.equal(prohibido.status, 404);

  const inexistente = await request(app)
    .get('/api/conductor/viajes/999999')
    .set('Authorization', conductor);

  assert.equal(inexistente.status, 404);

  const invalido = await request(app)
    .get('/api/conductor/viajes/abc')
    .set('Authorization', conductor);

  assert.equal(invalido.status, 400);

  const sinSesion = await request(app)
    .get(`/api/conductor/viajes/${propio}`);

  assert.equal(sinSesion.status, 401);
});

test('iniciar un viaje cambia su estado y la administración lo ve', async () => {
  const id = await viajeAsignado();

  const r = await request(app).post(`/api/conductor/viajes/${id}/iniciar`).set('Authorization', conductor);
  assert.equal(r.status, 200);
  assert.equal(r.body.viaje.estado, 'en-curso');
  assert.ok(r.body.viaje.iniciadoEn);

  const lista = await request(app).get('/api/admin/viajes').set('Authorization', admin);
  assert.equal(lista.body.viajes.find((v: { id: number }) => v.id === id).estado, 'en-curso');

  // un viaje en curso ya no se puede iniciar ni cancelar desde la administración
  assert.equal((await request(app).post(`/api/conductor/viajes/${id}/iniciar`).set('Authorization', conductor)).status, 409);
  const cancelar = await request(app).patch(`/api/admin/viajes/${id}`).set('Authorization', admin).send({ estado: 'cancelado' });
  assert.equal(cancelar.status, 409);

  await request(app).post(`/api/conductor/viajes/${id}/finalizar`).set('Authorization', conductor);
});

test('no se inicia otro viaje mientras haya uno en curso, ni con la misma van', async () => {
  const primero = await viajeAsignado(idConductor, 21);
  const segundo = await viajeAsignado(idConductor, 22);
  assert.equal((await request(app).post(`/api/conductor/viajes/${primero}/iniciar`).set('Authorization', conductor)).status, 200);

  const bloqueado = await request(app).post(`/api/conductor/viajes/${segundo}/iniciar`).set('Authorization', conductor);
  assert.equal(bloqueado.status, 409);
  assert.match(bloqueado.body.error, /en curso/);

  // otro conductor con la misma van tampoco puede salir
  const mismaVan = await viajeAsignado(idOtro, 21);
  assert.equal((await request(app).post(`/api/conductor/viajes/${mismaVan}/iniciar`).set('Authorization', otroConductor)).status, 409);

  assert.equal((await request(app).post(`/api/conductor/viajes/${primero}/finalizar`).set('Authorization', conductor)).status, 200);
  assert.equal((await request(app).post(`/api/conductor/viajes/${segundo}/iniciar`).set('Authorization', conductor)).status, 200);
  await request(app).post(`/api/conductor/viajes/${segundo}/finalizar`).set('Authorization', conductor);
});

test('un viaje sin van asignada no se puede iniciar', async () => {
  const { respuesta } = await abrir(['Ida']);
  const id = respuesta.body.viajes[0].id;
  await request(app).patch(`/api/admin/viajes/${id}`).set('Authorization', admin).send({ conductorId: idConductor });

  const r = await request(app).post(`/api/conductor/viajes/${id}/iniciar`).set('Authorization', conductor);
  assert.equal(r.status, 409);
  assert.match(r.body.error, /van/);
});

test('un conductor no puede operar viajes de otro conductor', async () => {
  const ajeno = await viajeAsignado(idOtro, 31);
  for (const accion of ['iniciar', 'finalizar']) {
    const r = await request(app).post(`/api/conductor/viajes/${ajeno}/${accion}`).set('Authorization', conductor);
    assert.equal(r.status, 404, accion);
  }
});

test('finalizar registra el cierre, completa las reservas y queda en el historial', async () => {
  const id = await viajeAsignado(idConductor, 41);
  await reservar(id, 1);
  await request(app).post(`/api/conductor/viajes/${id}/iniciar`).set('Authorization', conductor);

  const r = await request(app).post(`/api/conductor/viajes/${id}/finalizar`).set('Authorization', conductor);
  assert.equal(r.status, 200);
  assert.equal(r.body.viaje.estado, 'completado');
  assert.ok(r.body.viaje.finalizadoEn);
  assert.equal(r.body.viaje.reservas[0].estado, 'completada');

  // sigue en el listado del conductor y en el de la administración después de "recargar"
  const propio = await request(app).get('/api/conductor/viajes').set('Authorization', conductor);
  assert.equal(propio.body.viajes.find((v: { id: number }) => v.id === id).estado, 'completado');
  const todos = await request(app).get('/api/admin/viajes').set('Authorization', admin);
  assert.equal(todos.body.viajes.find((v: { id: number }) => v.id === id).estado, 'completado');

  // no se finaliza dos veces ni se vuelve a iniciar
  assert.equal((await request(app).post(`/api/conductor/viajes/${id}/finalizar`).set('Authorization', conductor)).status, 409);
  assert.equal((await request(app).post(`/api/conductor/viajes/${id}/iniciar`).set('Authorization', conductor)).status, 409);
});

test('no se finaliza un viaje que no está en curso', async () => {
  const id = await viajeAsignado(idConductor, 51);
  const r = await request(app).post(`/api/conductor/viajes/${id}/finalizar`).set('Authorization', conductor);
  assert.equal(r.status, 409);
});

/* ---------- Historial de estados (008 y 009) ---------- */

const historial = async (viajeId: number) =>
  (await pool.query(
    `SELECT estado_anterior, estado_nuevo, usuario_id FROM viajes_historial_estados WHERE viaje_id = $1 ORDER BY id`,
    [viajeId]
  )).rows;

test('cada cambio de estado queda en el historial con quién lo hizo', async () => {
  const id = await viajeAsignado(idConductor, 61);
  await request(app).post(`/api/conductor/viajes/${id}/iniciar`).set('Authorization', conductor);
  await request(app).post(`/api/conductor/viajes/${id}/finalizar`).set('Authorization', conductor);
  assert.deepEqual(await historial(id), [
    { estado_anterior: 'pendiente', estado_nuevo: 'en-curso', usuario_id: idConductor },
    { estado_anterior: 'en-curso', estado_nuevo: 'completado', usuario_id: idConductor },
  ]);

  // un cambio rechazado (409) no deja registro
  assert.equal((await request(app).post(`/api/conductor/viajes/${id}/iniciar`).set('Authorization', conductor)).status, 409);
  assert.equal((await historial(id)).length, 2);

  const { respuesta } = await abrir(['Ida']);
  const cancelado = respuesta.body.viajes[0].id as number;
  await request(app).patch(`/api/admin/viajes/${cancelado}`).set('Authorization', admin).send({ estado: 'cancelado' });
  assert.deepEqual(await historial(cancelado), [
    { estado_anterior: 'pendiente', estado_nuevo: 'cancelado', usuario_id: idAdmin },
  ]);
});

test('al borrar una cuenta, su historial se conserva sin el usuario', async () => {
  const idTemporal = await crearUsuario(`${PREFIJO}temporal@unab.cl`, 'aprobada', 'administrador');
  const { respuesta } = await abrir(['Ida']);
  const id = respuesta.body.viajes[0].id as number;
  const r = await request(app).patch(`/api/admin/viajes/${id}`).set('Authorization', autorizacion(idTemporal)).send({ estado: 'cancelado' });
  assert.equal(r.status, 200);

  // antes de 009_historial_usuario_set_null.sql este DELETE fallaba por la llave foránea
  await pool.query('DELETE FROM usuarios WHERE id = $1', [idTemporal]);
  assert.deepEqual(await historial(id), [
    { estado_anterior: 'pendiente', estado_nuevo: 'cancelado', usuario_id: null },
  ]);
});

/* ---------- Ruta GPS ---------- */

const RESPUESTA_ORS = {
  features: [{
    geometry: { coordinates: [[-71.54, -33.01], [-71.0, -33.2], [-70.634, -33.435]] },
    properties: { summary: { distance: 120500.4, duration: 5400.2 } },
  }],
};

function proveedorFalso(respuesta: () => Response) {
  const llamadas: { url: string; init: RequestInit }[] = [];
  configurarProveedor(async (url, init) => {
    llamadas.push({ url, init });
    return respuesta();
  });
  return llamadas;
}

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });

async function viajeEnCurso(vanId: number): Promise<number> {
  const id = await viajeAsignado(idConductor, vanId);
  assert.equal((await request(app).post(`/api/conductor/viajes/${id}/iniciar`).set('Authorization', conductor)).status, 200);
  return id;
}

async function terminar(id: number) {
  await request(app).post(`/api/conductor/viajes/${id}/finalizar`).set('Authorization', conductor);
}

test('la ruta se calcula hacia la sede de destino del viaje, no hacia un destino enviado por el cliente', async () => {
  const clave = config.orsApiKey;
  (config as { orsApiKey: string }).orsApiKey = 'clave-de-prueba';
  const llamadas = proveedorFalso(() => json(RESPUESTA_ORS));
  const id = await viajeEnCurso(61);

  const r = await request(app)
    .get(`/api/conductor/viajes/${id}/ruta?lat=-33.0&lon=-71.5&destino=Quintay`)
    .set('Authorization', conductor);

  assert.equal(r.status, 200);
  assert.deepEqual(r.body.ruta.coordenadas[0], [-33.01, -71.54]);
  assert.equal(r.body.ruta.distanciaM, 120500);
  assert.equal(r.body.ruta.duracionS, 5400);

  assert.equal(llamadas.length, 1);
  const enviado = JSON.parse(String(llamadas[0].init.body));
  assert.deepEqual(enviado.coordinates, [[-71.5, -33.0], [-70.634, -33.435172]], 'origen del conductor y destino Santiago');
  assert.equal((llamadas[0].init.headers as Record<string, string>).Authorization, 'clave-de-prueba');

  await terminar(id);
  (config as { orsApiKey: string }).orsApiKey = clave;
});

test('las consultas de ruta se reutilizan y se limitan para no saturar al proveedor', async () => {
  const clave = config.orsApiKey;
  (config as { orsApiKey: string }).orsApiKey = 'clave-de-prueba';
  const llamadas = proveedorFalso(() => json(RESPUESTA_ORS));
  const id = await viajeEnCurso(62);
  const pedir = (lat: string, lon: string) =>
    request(app).get(`/api/conductor/viajes/${id}/ruta?lat=${lat}&lon=${lon}`).set('Authorization', conductor);

  assert.equal((await pedir('-33.0000', '-71.5000')).status, 200);
  // casi la misma posición: se responde con la ruta guardada, sin consultar al proveedor
  assert.equal((await pedir('-33.0004', '-71.5004')).status, 200);
  assert.equal(llamadas.length, 1);
  // una posición lejana antes del intervalo mínimo se rechaza
  const demasiado = await pedir('-33.3', '-71.0');
  assert.equal(demasiado.status, 429);
  assert.equal(llamadas.length, 1);
  assert.ok(INTERVALO_MIN_MS >= 10_000);

  await terminar(id);
  (config as { orsApiKey: string }).orsApiKey = clave;
});

test('la ruta informa los errores del proveedor y la falta de configuración', async () => {
  const clave = config.orsApiKey;
  const id = await viajeEnCurso(63);
  const pedir = () => request(app).get(`/api/conductor/viajes/${id}/ruta?lat=-33.1&lon=-71.4`).set('Authorization', conductor);

  (config as { orsApiKey: string }).orsApiKey = '';
  configurarProveedor();
  const sinClave = await pedir();
  assert.equal(sinClave.status, 503);
  assert.match(sinClave.body.error, /no está configurado/);

  (config as { orsApiKey: string }).orsApiKey = 'clave-de-prueba';
  proveedorFalso(() => json({ error: 'cuota' }, 500));
  const caido = await pedir();
  assert.equal(caido.status, 502);

  await terminar(id);
  (config as { orsApiKey: string }).orsApiKey = clave;
  configurarProveedor();
});

test('la ruta exige un viaje propio en curso y una posición válida', async () => {
  const pendiente = await viajeAsignado(idConductor, 64);
  const ajeno = await viajeAsignado(idOtro, 65);
  const pedir = (id: number, consulta: string, token = conductor) =>
    request(app).get(`/api/conductor/viajes/${id}/ruta?${consulta}`).set('Authorization', token);

  assert.equal((await pedir(pendiente, 'lat=-33&lon=-71')).status, 409);
  assert.equal((await pedir(ajeno, 'lat=-33&lon=-71')).status, 404);
  assert.equal((await pedir(pendiente, 'lat=abc&lon=-71')).status, 400);
  assert.equal((await pedir(pendiente, 'lat=95&lon=-71')).status, 400);
  assert.equal((await pedir(pendiente, 'lon=-71')).status, 400);
});
