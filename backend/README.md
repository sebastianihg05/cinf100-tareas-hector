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

## Estructura

| Ruta | Contenido |
|---|---|
| `src/server.ts` | Punto de entrada: levanta el servidor en el puerto `PORT` (3000 por defecto). |
| `src/app.ts` | Aplicación Express y sus rutas. |
| `src/db.ts` | Pool de conexiones a PostgreSQL, configurado con `DATABASE_URL`. |
| `tests/` | Pruebas con `node:test` y `supertest`. |
