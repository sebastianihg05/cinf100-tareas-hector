import { firmarToken } from '../src/auth/tokens';
import { pool } from '../src/db';
import { hashContrasena } from '../src/usuarios/contrasenas';
import type { Estado, Rol } from '../src/usuarios/perfil';

// Contraseña de todos los usuarios que crean las pruebas.
export const CONTRASENA = 'Segura.2026';

let hash: Promise<string> | undefined;

// Crea un usuario directamente en la base, con el estado y el rol indicados.
export async function crearUsuario(
  correo: string,
  estado: Estado,
  rol: Rol | null = null
): Promise<number> {
  hash ??= hashContrasena(CONTRASENA);
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre_completo, correo, hash_contrasena, telefono, sede, rol, estado_aprobacion)
     VALUES ('Usuario de prueba', $1, $2, '+56911112222', $3, $4, $5)
     RETURNING id`,
    [correo, await hash, rol === 'administrador' ? null : 'Quintay', rol, estado]
  );
  return Number(rows[0].id);
}

// Encabezado Authorization con un token válido para ese usuario.
export function autorizacion(idUsuario: number): string {
  return `Bearer ${firmarToken(idUsuario)}`;
}

// Borra los usuarios cuyos correos empiezan con el prefijo de la prueba.
export async function borrarUsuarios(prefijo: string): Promise<void> {
  await pool.query('DELETE FROM usuarios WHERE correo LIKE $1', [`${prefijo}%`]);
}