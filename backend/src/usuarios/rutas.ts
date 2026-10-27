import { Router } from 'express';
import { firmarToken } from '../auth/tokens';
import { pool } from '../db';
import { hashContrasena, verificarContrasena } from './contrasenas';
import { aPerfil, COLUMNAS_PERFIL, type Estado } from './perfil';
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
       RETURNING ${COLUMNAS_PERFIL}`,
      [nombreCompleto, correo, hash, telefono, sede]
    );

    res.status(201).json({ usuario: aPerfil(rows[0]) });
  } catch (error) {
    // 23505 = valor duplicado: el índice único de correo lo detectó.
    if ((error as { code?: string }).code === '23505') {
      res.status(409).json({ errores: { correo: 'Ya existe una cuenta con este correo.' } });
      return;
    }
    throw error;
  }
});

// Hash de una contraseña que nadie conoce. Se usa para que el login tarde lo
// mismo exista o no el correo, y así no revele qué correos están registrados.
const hashFalso = hashContrasena('usuario-inexistente');

// BD-12: mensaje para cada estado que no puede iniciar sesión.
const BLOQUEOS: Record<Exclude<Estado, 'aprobada'>, string> = {
  pendiente: 'Tu cuenta está pendiente de aprobación por un administrador.',
  rechazada: 'Tu solicitud de registro fue rechazada.',
  desactivada: 'Tu cuenta está desactivada. Contacta a la administración.',
};

// BD-11: inicio de sesión con correo institucional y contraseña.
rutasAuth.post('/login', async (req, res) => {
  const cuerpo = (req.body ?? {}) as Record<string, unknown>;
  const correo = typeof cuerpo.correo === 'string' ? cuerpo.correo.trim().toLowerCase() : '';
  const contrasena = typeof cuerpo.contrasena === 'string' ? cuerpo.contrasena : '';
  if (!correo || !contrasena) {
    res.status(400).json({ error: 'Ingresa tu correo y tu contraseña.' });
    return;
  }

  const { rows } = await pool.query(
    'SELECT id, hash_contrasena, estado_aprobacion FROM usuarios WHERE correo = $1',
    [correo]
  );
  const fila = rows[0];
  const valida = await verificarContrasena(contrasena, fila?.hash_contrasena ?? (await hashFalso));

  // Mismo mensaje si el correo no existe o si la contraseña es incorrecta.
  if (!fila || !valida) {
    res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    return;
  }

  // BD-12: solo las cuentas aprobadas pueden entrar.
  const estado = fila.estado_aprobacion as Estado;
  if (estado !== 'aprobada') {
    res.status(403).json({ error: BLOQUEOS[estado], estado });
    return;
  }

  const actualizado = await pool.query(
    `UPDATE usuarios SET ultimo_ingreso_en = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING ${COLUMNAS_PERFIL}`,
    [fila.id]
  );

  res.json({ token: firmarToken(fila.id), usuario: aPerfil(actualizado.rows[0]) });
});