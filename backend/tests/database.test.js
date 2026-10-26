
const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../app/core/database.js');

test('conecta a PostgreSQL y ejecuta una consulta de prueba', async () => {
  const result = await pool.query('SELECT 1 AS ok');

  assert.equal(result.rows[0].ok, 1);
});

test.after(async () => {
  await pool.end();
});
