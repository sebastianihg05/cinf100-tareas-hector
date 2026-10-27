import { Router } from 'express';
import { requiereSesion } from '../auth/middleware';
import { pool } from '../db';
import { aPerfil, COLUMNAS_PERFIL } from './perfil';
import { normalizarTelefono } from './validacion';

// Perfil del usuario que inició sesión. Sirve para cualquier rol.
export const rutasPerfil = Router();

rutasPerfil.use(requiereSesion);

rutasPerfil.get('/me', (req, res) => {
  res.json({ usuario: req.usuario });
});

// Editar el celular del perfil. Es el único dato que el usuario cambia por sí mismo.
rutasPerfil.patch('/me', async (req, res) => {
  const telefono = normalizarTelefono(typeof req.body?.telefono === 'string' ? req.body.telefono : '');
  if (!telefono) {
    res.status(400).json({
      errores: { telefono: 'Ingresa un celular chileno válido, por ejemplo +56 9 1234 5678.' },
    });
    return;
  }

  const { rows } = await pool.query(
    `UPDATE usuarios SET telefono = $1 WHERE id = $2 RETURNING ${COLUMNAS_PERFIL}`,
    [telefono, req.usuario!.id]
  );
  res.json({ usuario: aPerfil(rows[0]) });
});