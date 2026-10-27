import jwt from 'jsonwebtoken';
import { config } from '../config';

// Duración de una sesión antes de tener que iniciar sesión de nuevo.
const DURACION = '8h';

// BD-13: el token solo guarda el id del usuario (en "sub").
// El rol y el estado se leen de la base en cada solicitud.
export function firmarToken(idUsuario: number): string {
  return jwt.sign({}, config.jwtSecret, {
    subject: String(idUsuario),
    expiresIn: DURACION,
    algorithm: 'HS256',
  });
}

export type ResultadoToken =
  | { ok: true; idUsuario: number }
  | { ok: false; motivo: 'vencido' | 'invalido' };

export function verificarToken(token: string): ResultadoToken {
  try {
    const datos = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    const id = typeof datos === 'object' ? Number(datos.sub) : NaN;
    return Number.isInteger(id) ? { ok: true, idUsuario: id } : { ok: false, motivo: 'invalido' };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { ok: false, motivo: 'vencido' };
    }
    return { ok: false, motivo: 'invalido' };
  }
}