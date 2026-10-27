# API — Registro de funcionarios (BD-08)

`POST /api/auth/registro`

Crea una solicitud de cuenta. La cuenta queda en estado `pendiente` y sin rol
hasta que un administrador la apruebe. Si el cliente envía `rol`,
`estado_aprobacion` u otros campos, se ignoran.

## Cuerpo (JSON)

| Campo | Obligatorio | Regla |
|---|---|---|
| `nombreCompleto` | Sí | Texto no vacío, máximo 150 caracteres. |
| `correo` | Sí | `@unab.cl` o `@uandresbello.edu`. Se guarda en minúsculas. |
| `contrasena` | Sí | Entre 8 y 72 caracteres. Se guarda solo su hash bcrypt. |
| `confirmacion` | Sí | Igual a `contrasena`. |
| `telefono` | Sí | Celular chileno. Acepta `+56 9 1234 5678`, `56912345678` o `912345678`; se guarda como `+56912345678`. |
| `sede` | Sí | `Quillota 980`, `Quintay`, `Rokamar` o `Santiago`. |

```json
{
  "nombreCompleto": "Ana Pérez",
  "correo": "ana.perez@unab.cl",
  "contrasena": "Segura.2026",
  "confirmacion": "Segura.2026",
  "telefono": "+56 9 1234 5678",
  "sede": "Quillota 980"
}
```

## Respuestas

| Código | Cuándo | Cuerpo |
|---|---|---|
| `201` | Cuenta creada | `{"usuario": {...}}` con `estado: "pendiente"` y `rol: null` (forma del usuario en `autenticacion.md`) |
| `400` | Datos inválidos o JSON mal formado | `{"errores": {"campo": "mensaje"}}` con un mensaje por campo con problemas |
| `409` | El correo ya está registrado (sin importar mayúsculas) | `{"errores": {"correo": "Ya existe una cuenta con este correo."}}` |
| `500` | Error inesperado | `{"error": "Error interno del servidor."}` |

La respuesta nunca incluye el hash de la contraseña.

## Probar a mano (PowerShell)

Con la base levantada y `npm run dev` corriendo en `backend/`:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/registro -ContentType 'application/json' -Body '{"nombreCompleto":"Ana Perez","correo":"ana.perez@unab.cl","contrasena":"Segura.2026","confirmacion":"Segura.2026","telefono":"+56 9 1234 5678","sede":"Quillota 980"}'
```