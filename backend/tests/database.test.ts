import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db';

test('conecta a PostgreSQL y ejecuta una consulta de prueba', async () => {
  const result = await pool.query('SELECT 1 AS ok');

  assert.equal(result.rows[0].ok, 1);
});

test('las migraciones 001 y 002 están aplicadas', async () => {
  const { rows } = await pool.query('SELECT version FROM schema_migrations');
  const versiones = rows.map((row) => row.version);

  assert.ok(versiones.includes('001_create_usuarios.sql'));
  assert.ok(versiones.includes('002_ajustes_usuarios.sql'));
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
