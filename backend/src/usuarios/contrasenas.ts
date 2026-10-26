import bcrypt from 'bcryptjs';

// Costo de bcrypt: 2^10 rondas. Es el mismo que usa el seed de la base.
const COSTO = 10;

export function hashContrasena(contrasena: string): Promise<string> {
  return bcrypt.hash(contrasena, COSTO);
}

// La usará el inicio de sesión (BD-11) para comparar con el hash guardado.
export function verificarContrasena(contrasena: string, hash: string): Promise<boolean> {
  return bcrypt.compare(contrasena, hash);
}