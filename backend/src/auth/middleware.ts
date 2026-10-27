import type { RequestHandler } from 'express';
import { pool } from '../db';
import { aPerfil, COLUMNAS_PERFIL, type Perfil, type Rol } from '../usuarios/perfil';
import { verificarToken } from './tokens';

declare global {
  namespace Express {
    interface Request {
      // Usuario autenticado; lo completa requiereSesion.
      usuario?: Perfil;
    }
  }
}

// BD-13: exige el encabezado "Authorization: Bearer <token>" con un token válido.
// Vuelve a leer el usuario en la base en cada solicitud: si un administrador
// lo desactiva o le cambia el rol, el cambio aplica de inmediato.
export const requiereSesion: RequestHandler = async (req, res, next) => {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    res.status(401).json({ error: 'Debes iniciar sesión.' });
    return;
  }

  const resultado = verificarToken(token);
  if (!resultado.ok) {
    const error = resultado.motivo === 'vencido'
      ? 'Tu sesión expiró. Inicia sesión de nuevo.'
      : 'Sesión inválida. Inicia sesión de nuevo.';
    res.status(401).json({ error });
    return;
  }

  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_PERFIL} FROM usuarios WHERE id = $1`,
    [resultado.idUsuario]
  );
  if (rows.length === 0 || rows[0].estado_aprobacion !== 'aprobada') {
    res.status(403).json({ error: 'Tu cuenta no tiene acceso al sistema.' });
    return;
  }

  req.usuario = aPerfil(rows[0]);
  next();
};

// BD-14: deja pasar solo a los roles indicados. Va después de requiereSesion.
export function requiereRol(...roles: Rol[]): RequestHandler {
  return (req, res, next) => {
    if (!req.usuario?.rol || !roles.includes(req.usuario.rol)) {
      res.status(403).json({ error: 'No tienes permiso para realizar esta acción.' });
      return;
    }
    next();
  };
}