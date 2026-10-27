export type Rol = 'administrador' | 'funcionario' | 'conductor';
export type Estado = 'pendiente' | 'aprobada' | 'rechazada' | 'desactivada';

// Columnas que se pueden mostrar de un usuario. Nunca incluye hash_contrasena.
export const COLUMNAS_PERFIL = `
  id, nombre_completo, correo, telefono, sede, rol,
  estado_aprobacion, creado_en, ultimo_ingreso_en`;

export type FilaPerfil = {
  id: number;
  nombre_completo: string;
  correo: string;
  telefono: string;
  sede: string | null;
  rol: Rol | null;
  estado_aprobacion: Estado;
  creado_en: Date;
  ultimo_ingreso_en: Date | null;
};

// Lo que la API devuelve de un usuario, con nombres en camelCase.
export type Perfil = {
  id: number;
  nombreCompleto: string;
  correo: string;
  telefono: string;
  sede: string | null;
  rol: Rol | null;
  estado: Estado;
  creadoEn: Date;
  ultimoIngresoEn: Date | null;
};

export function aPerfil(fila: FilaPerfil): Perfil {
  return {
    id: fila.id,
    nombreCompleto: fila.nombre_completo,
    correo: fila.correo,
    telefono: fila.telefono,
    sede: fila.sede,
    rol: fila.rol,
    estado: fila.estado_aprobacion,
    creadoEn: fila.creado_en,
    ultimoIngresoEn: fila.ultimo_ingreso_en,
  };
}