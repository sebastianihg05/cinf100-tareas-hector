// Se ejecuta solo antes de `npm run dev` en la raíz del repositorio:
// 1. Crea los .env que falten a partir de los .env.example.
// 2. Si SEED_PASSWORD está vacía, genera una para las cuentas de prueba.
// 3. Levanta PostgreSQL y Adminer con Docker y espera a que terminen las migraciones.
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const ruta = (archivo) => path.join(raiz, archivo)

function crearSiFalta(destino, ejemplo) {
  if (existsSync(ruta(destino))) return
  copyFileSync(ruta(ejemplo), ruta(destino))
  console.log(`Creado ${destino} a partir de ${ejemplo}.`)
}

crearSiFalta('.env', '.env.example')
crearSiFalta('backend/.env', 'backend/.env.example')

// Contraseña de las cuentas de prueba (dev.admin@unab.cl, etc.). Queda solo en tu .env, que no se sube a GitHub.
let env = readFileSync(ruta('.env'), 'utf8')
let clave = env.match(/^SEED_PASSWORD=(.*)$/m)?.[1].trim()
if (!clave) {
  clave = `Dev-${randomBytes(6).toString('base64url')}`
  env = /^SEED_PASSWORD=/m.test(env)
    ? env.replace(/^SEED_PASSWORD=.*$/m, `SEED_PASSWORD=${clave}`)
    : `${env.trimEnd()}\nSEED_PASSWORD=${clave}\n`
  writeFileSync(ruta('.env'), env)
  console.log('Generada una contraseña para las cuentas de prueba (SEED_PASSWORD en .env).')
}

const compose = (args, mostrar) =>
  spawnSync('docker', ['compose', ...args], { cwd: raiz, encoding: 'utf8', stdio: mostrar ? 'inherit' : 'pipe' })

console.log('Levantando la base de datos con Docker (la primera vez descarga las imágenes y tarda unos minutos)...')
const levantar = compose(['up', '-d'], true)
if (levantar.error || levantar.status !== 0) {
  console.error('No se pudo levantar la base de datos. Abre Docker Desktop, espera a que diga "Engine running" y vuelve a ejecutar npm run dev.')
  process.exit(1)
}

// Espera al servicio migrate (migraciones y usuarios de prueba). Docker Compose antiguo no tiene `wait`: se omite.
const migrar = compose(['wait', 'migrate'], false)
if (migrar.status !== 0 && !/unknown|not a docker command/i.test(migrar.stderr ?? '')) {
  compose(['logs', 'migrate'], true)
  console.error('Las migraciones fallaron: revisa el mensaje de arriba.')
  process.exit(1)
}

console.log(`
Base de datos lista.
  App:      http://localhost:5173
  Adminer:  http://localhost:8080 (PostgreSQL · database · devhub / devhub · cinf100)
  Entra con dev.admin@unab.cl y la contraseña ${clave}
`)
