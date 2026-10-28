# Backend (Node.js + Express + TypeScript)

API del sistema. Se conecta a la base de datos PostgreSQL que levanta
`docker compose up -d` (ver `database/README.md`).

## Preparar

Requisito: Node.js 22 o superior.

```bash
cd backend
cp .env.example .env      # en PowerShell: Copy-Item .env.example .env
npm install
```

`.env` no se sube a Git. Sus valores por defecto coinciden con `docker-compose.yml`.

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL. |
| `JWT_SECRET` | Clave para firmar las sesiones. Si falta, en desarrollo se usa una temporal y las sesiones se pierden al reiniciar. |
| `FRONTEND_ORIGIN` | Dirección del frontend autorizada a llamar a la API (por defecto `http://localhost:5173`). |

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta la API en `http://localhost:3000` y se reinicia al guardar cambios. |
| `npm test` | Ejecuta las pruebas de `tests/` (necesita la base levantada). |
| `npm run typecheck` | Revisa los tipos de TypeScript sin compilar. |
| `npm run build` | Compila `src/` a `dist/`. |
| `npm start` | Ejecuta la versión compilada de `dist/`. |

Para comprobar que la API ve la base de datos, abre
`http://localhost:3000/api/health`. Debe responder:

```json
{"status":"ok","database":"conectada","migraciones":["001_create_usuarios.sql","002_ajustes_usuarios.sql"]}
```

Si la base no está levantada responde `503` con `"database":"sin conexión"`.

## Endpoints

| Ruta | Documentación |
|---|---|
| `POST /api/auth/registro` | `docs/api/registro.md` |
| `POST /api/auth/login`, `/api/usuarios/me`, `/api/admin/...` | `docs/api/autenticacion.md` |

## Iniciar sesión con las cuentas de prueba

Lo más simple es `npm run dev` en la raíz del repositorio: levanta la base, la API y el frontend, y muestra la contraseña. A mano:

1. En la raíz del repositorio, crea `.env` (copia de `.env.example`) y ponle una contraseña a `SEED_PASSWORD`, por ejemplo `SEED_PASSWORD=Demo.2026`.
2. Ejecuta `docker compose up -d`: el seed deja esa contraseña en todas las cuentas `dev.*`.
3. Con `npm run dev`, inicia sesión con `dev.admin@unab.cl` (administrador), `dev.funcionario@unab.cl` o `dev.conductor@unab.cl`.

## Estructura

| Ruta | Contenido |
|---|---|
| `src/server.ts` | Punto de entrada: levanta el servidor en el puerto `PORT` (3000 por defecto). |
| `src/app.ts` | Aplicación Express: CORS, rutas y manejo de errores. |
| `src/config.ts` | Lee las variables de `backend/.env`. |
| `src/db.ts` | Pool de conexiones a PostgreSQL. |
| `src/auth/` | Tokens JWT y middlewares de sesión y de rol. |
| `src/usuarios/` | Registro, login, perfil, validaciones y hash de contraseñas. |
| `src/admin/` | Rutas del administrador: solicitudes y usuarios. |
| `tests/` | Pruebas con `node:test` y `supertest` (`ayudantes.ts` crea usuarios de prueba). |