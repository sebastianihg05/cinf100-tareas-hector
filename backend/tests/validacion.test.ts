import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarTelefono, validarRegistro } from '../src/usuarios/validacion';

const valido = {
  nombreCompleto: 'Ana Pérez',
  correo: 'Ana.Perez@UNAB.cl',
  contrasena: 'Segura.2026',
  confirmacion: 'Segura.2026',
  telefono: '+56 9 1234 5678',
  sede: 'Quillota 980',
};

function errores(cambios: Record<string, unknown>) {
  const resultado = validarRegistro({ ...valido, ...cambios });
  assert.equal(resultado.ok, false);
  return resultado.ok ? {} : resultado.errores;
}

test('acepta un registro válido y normaliza correo y teléfono', () => {
  const resultado = validarRegistro(valido);

  assert.ok(resultado.ok);
  assert.equal(resultado.datos.correo, 'ana.perez@unab.cl');
  assert.equal(resultado.datos.telefono, '+56912345678');
});

test('rechaza correos no institucionales', () => {
  assert.ok(errores({ correo: 'ana@gmail.com' }).correo);
  assert.ok(errores({ correo: 'ana@alumnos.unab.cl' }).correo);
});

test('acepta @uandresbello.edu', () => {
  assert.ok(validarRegistro({ ...valido, correo: 'ana@uandresbello.edu' }).ok);
});

test('exige todos los campos obligatorios', () => {
  const resultado = validarRegistro({});

  assert.equal(resultado.ok, false);
  if (!resultado.ok) {
    assert.deepEqual(Object.keys(resultado.errores).sort(), [
      'confirmacion', 'contrasena', 'correo', 'nombreCompleto', 'sede', 'telefono',
    ]);
  }
});

test('rechaza un nombre con solo espacios', () => {
  assert.ok(errores({ nombreCompleto: '   ' }).nombreCompleto);
});

test('exige contraseña de al menos 8 caracteres y que coincida', () => {
  assert.ok(errores({ contrasena: 'corta', confirmacion: 'corta' }).contrasena);
  assert.ok(errores({ confirmacion: 'Otra.2026' }).confirmacion);
});

test('rechaza contraseñas de más de 72 bytes', () => {
  const larga = 'a'.repeat(73);
  assert.ok(errores({ contrasena: larga, confirmacion: larga }).contrasena);
});

test('rechaza sedes fuera de la lista', () => {
  assert.ok(errores({ sede: 'Concepcion' }).sede);
});

test('normaliza celulares chilenos y rechaza el resto', () => {
  assert.equal(normalizarTelefono('912345678'), '+56912345678');
  assert.equal(normalizarTelefono('56912345678'), '+56912345678');
  assert.equal(normalizarTelefono('+56 9 1234 5678'), '+56912345678');
  assert.equal(normalizarTelefono('221234567'), null);
  assert.equal(normalizarTelefono('abc'), null);
});