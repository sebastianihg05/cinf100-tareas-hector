import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db';

test('conecta a PostgreSQL y ejecuta una consulta de prueba', async () => {
  const result = await pool.query('SELECT 1 AS ok');

  assert.equal(result.rows[0].ok, 1);
});

test('las migraciones 001 a 005 están aplicadas', async () => {
  const { rows } = await pool.query('SELECT version FROM schema_migrations');
  const versiones = rows.map((row) => row.version);

  assert.ok(versiones.includes('001_create_usuarios.sql'));
  assert.ok(versiones.includes('002_ajustes_usuarios.sql'));
  assert.ok(versiones.includes('003_conductores.sql'));
  assert.ok(versiones.includes('004_viajes.sql'));
  assert.ok(versiones.includes('005_reservas.sql'));
});

test('la base rechaza un viaje de ida con otro horario', async () => {
  await assert.rejects(
    pool.query(
      `INSERT INTO viajes (fecha, hora, trayecto, origen, destino)
       VALUES (CURRENT_DATE + 400, '08:00', 'Ida', 'Quillota 980', 'Santiago')`
    ),
    { constraint: 'viajes_ruta_check' }
  );
});

test('la base rechaza el asiento 10 (la Staria tiene 9 reservables)', async () => {
  await assert.rejects(
    pool.query(
      `INSERT INTO reservas (grupo_id, usuario_id, viaje_id, asiento)
       VALUES (gen_random_uuid(), -1, -1, 10)`
    ),
    { constraint: 'reservas_asiento_check' }
  );
});

test('la base rechaza un RUT de conductor sin puntos ni guion', async () => {
  await assert.rejects(
    pool.query(`INSERT INTO conductores (usuario_id, rut) VALUES (-1, '139876547')`),
    { constraint: 'conductores_rut_formato_check' }
  );
});

test('la base rechaza un correo no institucional', async () => {
  await assert.rejects(
    pool.query(
      `INSERT INTO usuarios (nombre_completo, correo, hash_contrasena, telefono, sede)
       VALUES ('Prueba', 'prueba@gmail.com', '$2a$10$x', '+56912345678', 'Quintay')`
    ),
    { constraint: 'usuarios_correo_institucional_check' }
  );
});

test.after(async () => {
  await pool.end();
});
