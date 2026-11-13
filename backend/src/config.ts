import path from 'node:path';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';

// Carga backend/.env (funciona desde src/ y desde dist/).
// Las variables ya definidas, como en el CI, no se sobrescriben.
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

function obligatoria(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta ${nombre}. Configúrala en backend/.env (ver backend/.env.example).`);
  }
  return valor;
}

// Clave con la que se firman los tokens de sesión (BD-13).
// En desarrollo, si no está definida, se usa una temporal: las sesiones
// se pierden al reiniciar el servidor. En producción es obligatoria.
function claveJwt(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') return obligatoria('JWT_SECRET');
  console.warn('JWT_SECRET no está definida en backend/.env: se usa una clave temporal.');
  return randomBytes(32).toString('hex');
}

export const config = {
  databaseUrl: obligatoria('DATABASE_URL'),
  jwtSecret: claveJwt(),
  // Dirección del frontend de Vite, autorizada a llamar a la API (CORS).
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  // GPS-05: cálculo de rutas con openrouteservice. La clave vive solo en el backend; sin ella el GPS
  // sigue mostrando la posición, pero la ruta responde "servicio no configurado".
  orsApiKey: process.env.ORS_API_KEY ?? '',
  orsUrl: process.env.ORS_URL ?? 'https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson',
};