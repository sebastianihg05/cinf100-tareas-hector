import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';

test('GET /api/health informa que la base está conectada', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.database, 'conectada');
  assert.ok(response.body.migraciones.includes('002_ajustes_usuarios.sql'));
});

test.after(async () => {
  await pool.end();
});
