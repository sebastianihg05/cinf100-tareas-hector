import test from 'node:test';
import assert from 'node:assert/strict';
import { hashContrasena, verificarContrasena } from '../src/usuarios/contrasenas';

test('el hash es bcrypt y no contiene la contraseña', async () => {
  const hash = await hashContrasena('Segura.2026');

  assert.match(hash, /^\$2[aby]\$10\$/);
  assert.ok(!hash.includes('Segura.2026'));
});

test('dos hashes de la misma contraseña son distintos (sal aleatoria)', async () => {
  assert.notEqual(await hashContrasena('Segura.2026'), await hashContrasena('Segura.2026'));
});

test('verifica la contraseña correcta y rechaza una incorrecta', async () => {
  const hash = await hashContrasena('Segura.2026');

  assert.equal(await verificarContrasena('Segura.2026', hash), true);
  assert.equal(await verificarContrasena('segura.2026', hash), false);
});