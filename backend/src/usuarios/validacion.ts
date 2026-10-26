export const SEDES = ['Quillota 980', 'Quintay', 'Rokamar', 'Santiago'] as const;

export type Sede = (typeof SEDES)[number];

export type DatosRegistro = {
  nombreCompleto: string;
  correo: string;
  contrasena: string;
  telefono: string;
  sede: Sede;
};

export type ResultadoValidacion =
  | { ok: true; datos: DatosRegistro }
  | { ok: false; errores: Record<string, string> };

const DOMINIO_INSTITUCIONAL = /^[^@\s]+@(unab\.cl|uandresbello\.edu)$/;

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

// Acepta '+56 9 1234 5678', '56912345678' o '912345678'.
// Devuelve '+569XXXXXXXX' (el formato que exige la base) o null.
export function normalizarTelefono(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '');
  const local = digitos.length === 11 && digitos.startsWith('56') ? digitos.slice(2) : digitos;
  return /^9\d{8}$/.test(local) ? `+56${local}` : null;
}

// Valida los datos del formulario de registro (BD-09).
// Solo lee los campos permitidos: rol, estado o id enviados por el cliente se ignoran.
export function validarRegistro(cuerpo: unknown): ResultadoValidacion {
  const datos = (typeof cuerpo === 'object' && cuerpo !== null ? cuerpo : {}) as Record<string, unknown>;
  const errores: Record<string, string> = {};

  const nombreCompleto = texto(datos.nombreCompleto);
  if (!nombreCompleto) {
    errores.nombreCompleto = 'El nombre completo es obligatorio.';
  } else if (nombreCompleto.length > 150) {
    errores.nombreCompleto = 'El nombre completo no puede superar 150 caracteres.';
  }

  const correo = texto(datos.correo).toLowerCase();
  if (!correo) {
    errores.correo = 'El correo es obligatorio.';
  } else if (correo.length > 254 || !DOMINIO_INSTITUCIONAL.test(correo)) {
    errores.correo = 'Usa tu correo institucional @unab.cl o @uandresbello.edu.';
  }

  // La contraseña no se recorta: los espacios son parte de ella.
  const contrasena = typeof datos.contrasena === 'string' ? datos.contrasena : '';
  const confirmacion = typeof datos.confirmacion === 'string' ? datos.confirmacion : '';
  if (!contrasena) {
    errores.contrasena = 'La contraseña es obligatoria.';
  } else if (contrasena.length < 8) {
    errores.contrasena = 'La contraseña debe tener al menos 8 caracteres.';
  } else if (Buffer.byteLength(contrasena, 'utf8') > 72) {
    // bcrypt solo usa los primeros 72 bytes; más largo se ignoraría en silencio.
    errores.contrasena = 'La contraseña no puede superar 72 caracteres.';
  }
  if (!confirmacion) {
    errores.confirmacion = 'Confirma tu contraseña.';
  } else if (contrasena && confirmacion !== contrasena) {
    errores.confirmacion = 'Las contraseñas no coinciden.';
  }

  const telefono = normalizarTelefono(texto(datos.telefono));
  if (!telefono) {
    errores.telefono = 'Ingresa un celular chileno válido, por ejemplo +56 9 1234 5678.';
  }

  const sede = texto(datos.sede);
  if (!SEDES.includes(sede as Sede)) {
    errores.sede = `La sede debe ser una de: ${SEDES.join(', ')}.`;
  }

  if (Object.keys(errores).length > 0) {
    return { ok: false, errores };
  }

  return {
    ok: true,
    datos: { nombreCompleto, correo, contrasena, telefono: telefono!, sede: sede as Sede },
  };
}