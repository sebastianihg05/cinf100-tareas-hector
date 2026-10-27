# API — Inicio de sesión, perfiles y administración (BD-11 a BD-16)

Guía para conectar el frontend con el backend. La API corre en
`http://localhost:3000` con `npm run dev` en `backend/` (ver `backend/README.md`).
El frontend de Vite (`http://localhost:5173`) ya está autorizado por CORS.

## Resumen

| Método | Ruta | Quién | Para qué |
|---|---|---|---|
| `POST` | `/api/auth/registro` | Cualquiera | Crear una solicitud de cuenta (ver `registro.md`). |
| `POST` | `/api/auth/login` | Cualquiera | Iniciar sesión; devuelve el token y el usuario. |
| `GET` | `/api/usuarios/me` | Con sesión | Ver el perfil propio. |
| `PATCH` | `/api/usuarios/me` | Con sesión | Cambiar el celular propio. |
| `GET` | `/api/admin/solicitudes` | Administrador | Listar solicitudes pendientes. |
| `GET` | `/api/admin/usuarios` | Administrador | Listar todos los usuarios. |
| `POST` | `/api/admin/solicitudes/:id/aprobar` | Administrador | Aprobar y asignar rol (`funcionario` o `conductor`). |
| `POST` | `/api/admin/solicitudes/:id/rechazar` | Administrador | Rechazar la solicitud. |

## El usuario que devuelve la API

Todas las rutas devuelven al usuario con esta forma. Nunca incluyen la contraseña ni su hash.

```json
{
  "id": 1,
  "nombreCompleto": "Administrador Desarrollo",
  "correo": "dev.admin@unab.cl",
  "telefono": "+56900000001",
  "sede": null,
  "rol": "administrador",
  "estado": "aprobada",
  "creadoEn": "2026-10-27T21:39:32.683Z",
  "ultimoIngresoEn": "2026-10-27T21:40:40.395Z"
}
```

| Campo | Valores |
|---|---|
| `rol` | `administrador`, `funcionario`, `conductor`, o `null` mientras la cuenta no está aprobada. |
| `estado` | `pendiente`, `aprobada`, `rechazada`, `desactivada`. |
| `sede` | `Quillota 980`, `Quintay`, `Rokamar`, `Santiago`, o `null` para el administrador. |

En el frontend el rol del administrador se llama `admin`: al recibir `administrador`, convertirlo a `admin`.

## Iniciar sesión (BD-11, BD-12)

`POST /api/auth/login`

```json
{ "correo": "dev.admin@unab.cl", "contrasena": "..." }
```

| Código | Cuándo | Cuerpo |
|---|---|---|
| `200` | Correo y contraseña correctos, cuenta aprobada | `{"token": "...", "usuario": {...}}` |
| `400` | Falta el correo o la contraseña | `{"error": "Ingresa tu correo y tu contraseña."}` |
| `401` | Correo o contraseña incorrectos (mismo mensaje en ambos casos) | `{"error": "Correo o contraseña incorrectos."}` |
| `403` | Contraseña correcta, pero la cuenta no está aprobada | `{"error": "...", "estado": "pendiente" \| "rechazada" \| "desactivada"}` |

Con `403` y `estado: "pendiente"`, el frontend puede mostrar la pantalla `Pendiente`.
Después de iniciar sesión, la redirección depende de `usuario.rol`.

## Usar el token (BD-13)

El token dura **8 horas**. Hay que enviarlo en cada ruta protegida:

```
Authorization: Bearer <token>
```

| Código | Cuándo |
|---|---|
| `401` | No se envió token, es inválido o expiró (`"Tu sesión expiró. Inicia sesión de nuevo."`). Volver al login. |
| `403` | La cuenta fue desactivada, o el rol no tiene permiso para esa ruta. |

El backend lee el rol desde la base en cada solicitud, así que **la seguridad no
depende del frontend**: cambiar el rol guardado en el navegador no da acceso a nada.

## Perfil propio (BD-14)

- `GET /api/usuarios/me` → `{"usuario": {...}}`
- `PATCH /api/usuarios/me` con `{"telefono": "+56 9 8765 4321"}` → `{"usuario": {...}}` con el celular normalizado, o `400` con `{"errores": {"telefono": "..."}}`.

## Administración (BD-15, BD-16)

Solo para `rol: "administrador"`. Otro rol recibe `403`.

- `GET /api/admin/solicitudes` → `{"solicitudes": [usuario, ...]}`, de la más antigua a la más nueva.
- `GET /api/admin/usuarios` → `{"usuarios": [usuario, ...]}`.
- `POST /api/admin/solicitudes/:id/aprobar` con `{"rol": "funcionario"}` o `{"rol": "conductor"}` → `{"usuario": {...}}` con `estado: "aprobada"`.
- `POST /api/admin/solicitudes/:id/rechazar` (sin cuerpo) → `{"usuario": {...}}` con `estado: "rechazada"`.

| Código | Cuándo |
|---|---|
| `400` | El id no es un número, o el rol no es `funcionario` ni `conductor`. |
| `404` | No existe un usuario con ese id. |
| `409` | La solicitud ya fue aprobada o rechazada. |

La base guarda qué administrador tomó la decisión y cuándo (`decidido_por`, `decidido_en`).

## Ejemplo para el frontend (TypeScript)

```ts
const API = 'http://localhost:3000/api';

export async function iniciarSesion(correo: string, contrasena: string) {
  const respuesta = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena }),
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    // datos.error tiene el mensaje para mostrar; datos.estado indica si está pendiente, etc.
    throw Object.assign(new Error(datos.error), { estado: datos.estado });
  }
  sessionStorage.setItem('unab-token', datos.token);
  return datos.usuario;
}

export async function obtenerSolicitudes() {
  const respuesta = await fetch(`${API}/admin/solicitudes`, {
    headers: { Authorization: `Bearer ${sessionStorage.getItem('unab-token')}` },
  });
  if (respuesta.status === 401) {
    // La sesión expiró: volver al login.
  }
  return (await respuesta.json()).solicitudes;
}
```

## Probar a mano (PowerShell)

Con la base y la API levantadas, y `SEED_PASSWORD` definida en el `.env` de la raíz:

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/login -ContentType 'application/json' -Body '{"correo":"dev.admin@unab.cl","contrasena":"TU_SEED_PASSWORD"}'
$cabecera = @{ Authorization = "Bearer $($login.token)" }
Invoke-RestMethod -Uri http://localhost:3000/api/usuarios/me -Headers $cabecera
Invoke-RestMethod -Uri http://localhost:3000/api/admin/solicitudes -Headers $cabecera
```