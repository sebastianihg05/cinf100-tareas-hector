import { Router } from 'express';
import { pool } from '../db';
import { hashContrasena } from './contrasenas';
import { validarRegistro } from './validacion';

export const rutasAuth = Router();

// BD-08: registro de funcionarios.
// La cuenta queda 'pendiente' y sin rol: el rol lo asigna un administrador al aprobarla.
rutasAuth.post('/registro', async (req, res) => {
  const resultado = validarRegistro(req.body);
  if (!resultado.ok) {
    res.status(400).json({ errores: resultado.errores });
    return;
  }

  const { nombreCompleto, correo, contrasena, telefono, sede } = resultado.datos;
  const hash = await hashContrasena(contrasena);

  try {
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre_completo, correo, hash_contrasena, telefono, sede)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre_completo, correo, sede, estado_aprobacion, creado_en`,
      [nombreCompleto, correo, hash, telefono, sede]
    );

    res.status(201).json({ usuario: rows[0] });
  } catch (error) {
    // 23505 = valor duplicado: el índice único de correo lo detectó.
    if ((error as { code?: string }).code === '23505') {
      res.status(409).json({ errores: { correo: 'Ya existe una cuenta con este correo.' } });
      return;
    }
    throw error;
  }
});