import { Router } from 'express';
import { pool } from '../db';
import type { Estado } from '../usuarios/perfil';
import { normalizarTelefono } from '../usuarios/validacion';

// Datos de conductor (tabla conductores) junto a su cuenta. Solo administradores: se monta en rutasAdmin.
export const rutasConductores = Router();

export const COLUMNAS_CONDUCTOR = `
  u.id, u.nombre_completo, u.correo, u.telefono, u.estado_aprobacion,
  c.rut, TO_CHAR(c.licencia_hasta, 'YYYY-MM-DD') AS licencia_hasta, c.activo`;

export type FilaConductor = {
  id: number;
  nombre_completo: string;
  correo: string;
  telefono: string;
  estado_aprobacion: Estado;
  rut: string | null;
  licencia_hasta: string | null;
  activo: boolean;
};

export function aConductor(fila: FilaConductor) {
  return {
    id: fila.id,
    nombreCompleto: fila.nombre_completo,
    correo: fila.correo,
    telefono: fila.telefono,
    estado: fila.estado_aprobacion,
    rut: fila.rut,
    licenciaHasta: fila.licencia_hasta,
    activo: fila.activo,
  };
}

// Devuelve el RUT con puntos y guion (12.345.678-5) o null si no tiene forma de RUT. No revisa el dígito verificador.
export function formatearRut(valor: string): string | null {
  const limpio = valor.replace(/[.\s-]/g, '').toUpperCase();
  if (!/^\d{7,8}[\dK]$/.test(limpio)) return null;
  const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpo}-${limpio.slice(-1)}`;
}

function esFechaValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().startsWith(valor);
}

// Conductores aprobados o desactivados, con sus datos de conductor.
rutasConductores.get('/', async (_req, res) => {
  const { rows } = await pool.query<FilaConductor>(
    `SELECT ${COLUMNAS_CONDUCTOR} FROM conductores c
       JOIN usuarios u ON u.id = c.usuario_id
      ORDER BY u.id`
  );
  res.json({ conductores: rows.map(aConductor) });
});

// Actualiza el RUT, la licencia, si está activo o el celular de su cuenta. El nombre no se cambia aquí.
rutasConductores.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'El id del conductor no es válido.' });
    return;
  }

  const cuerpo = (req.body ?? {}) as Record<string, unknown>;
  const errores: Record<string, string> = {};
  const cambios: { columna: string; valor: unknown }[] = [];

  if (cuerpo.rut !== undefined) {
    const rut = typeof cuerpo.rut === 'string' ? formatearRut(cuerpo.rut) : null;
    if (rut) cambios.push({ columna: 'rut', valor: rut });
    else errores.rut = 'RUT inválido. Escribe 7 u 8 números y el dígito final, por ejemplo 12.345.678-5';
  }
  if (cuerpo.licenciaHasta !== undefined) {
    if (typeof cuerpo.licenciaHasta === 'string' && esFechaValida(cuerpo.licenciaHasta)) {
      cambios.push({ columna: 'licencia_hasta', valor: cuerpo.licenciaHasta });
    } else {
      errores.licenciaHasta = 'La fecha de la licencia debe tener el formato AAAA-MM-DD.';
    }
  }
  if (cuerpo.activo !== undefined) {
    if (typeof cuerpo.activo === 'boolean') cambios.push({ columna: 'activo', valor: cuerpo.activo });
    else errores.activo = 'El campo activo debe ser true o false.';
  }
  // el celular vive en la tabla usuarios: es el mismo que el conductor ve en su perfil
  let telefono: string | null = null;
  if (cuerpo.telefono !== undefined) {
    telefono = normalizarTelefono(typeof cuerpo.telefono === 'string' ? cuerpo.telefono : '');
    if (!telefono) errores.telefono = 'Ingresa un celular chileno válido, por ejemplo +56 9 1234 5678.';
  }

  if (Object.keys(errores).length > 0) {
    res.status(400).json({ errores });
    return;
  }
  if (cambios.length === 0 && !telefono) {
    res.status(400).json({ error: 'Indica el RUT, la licencia, el celular o si el conductor está activo.' });
    return;
  }

  const existe = await pool.query('SELECT 1 FROM conductores WHERE usuario_id = $1', [id]);
  if (existe.rowCount === 0) {
    res.status(404).json({ error: 'El conductor no existe.' });
    return;
  }

  // los dos cambios se guardan juntos o ninguno
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    if (cambios.length > 0) {
      const set = cambios.map((c, i) => `${c.columna} = $${i + 2}`).join(', ');
      await cliente.query(`UPDATE conductores SET ${set} WHERE usuario_id = $1`, [id, ...cambios.map((c) => c.valor)]);
    }
    if (telefono) await cliente.query('UPDATE usuarios SET telefono = $2 WHERE id = $1', [id, telefono]);
    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505') {
      res.status(409).json({ errores: { rut: 'Ya existe un conductor con ese RUT.' } });
      return;
    }
    throw error;
  } finally {
    cliente.release();
  }

  const { rows } = await pool.query<FilaConductor>(
    `SELECT ${COLUMNAS_CONDUCTOR} FROM conductores c
       JOIN usuarios u ON u.id = c.usuario_id
      WHERE c.usuario_id = $1`,
    [id]
  );
  res.json({ conductor: aConductor(rows[0]) });
});
