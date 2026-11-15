# API de viajes

Viajes del transporte institucional (tabla `viajes`, migración `004_viajes.sql`) y sus reservas (`005_reservas.sql`).
Todas las rutas exigen `Authorization: Bearer <token>`. Los errores responden `{ "error": "..." }` o, si falla un campo,
`{ "errores": { "campo": "..." } }`.

Formato de un viaje (`ReservaViaje` solo trae a quienes reservaron):

```json
{
  "id": 25,
  "fecha": "2026-11-18",
  "hora": "06:45",
  "trayecto": "Ida",
  "origen": "Quillota 980",
  "destino": "Santiago",
  "vanId": 1,
  "conductorId": 4,
  "estado": "pendiente",
  "iniciadoEn": null,
  "finalizadoEn": null,
  "canceladoEn": null,
  "reservas": [
    { "id": 9, "grupoId": "…", "usuarioId": 6, "nombre": "Funcionario Aprobado", "telefono": "+56900000002", "asiento": 1, "estado": "pendiente", "creadaEn": "2026-11-10T14:03:00.000Z" }
  ]
}
```

`estado`: `pendiente`, `en-curso`, `completado` o `cancelado`. `vanId` es el `id` de la tabla `vans` (migración `006_vans.sql`).
`conductorId` es el `id` de la cuenta del conductor.

## Administración (rol `administrador`)

### GET /api/admin/viajes
Todos los viajes, del más antiguo al más nuevo, con sus reservas (incluidas las canceladas).

### POST /api/admin/viajes
Abre uno o dos viajes con la ruta y el horario fijos (Ida 06:45 Quillota 980 → Santiago, Vuelta 17:00 Santiago → Quillota 980).
Se guardan los dos o ninguno.

```json
{ "fecha": "2026-11-18", "trayectos": ["Ida", "Vuelta"] }
```

| Código | Cuándo |
|---|---|
| 201 | `{ "viajes": [...] }` |
| 400 | Fecha inválida o fuera de 1 a 30 días desde hoy (día de Chile), o `trayectos` vacío, repetido o desconocido |
| 409 | Ya hay un viaje activo ese día para el trayecto |

### PATCH /api/admin/viajes/:id
Un cambio por solicitud, solo sobre viajes `pendiente`:

- Asignar: `{ "vanId": 1, "conductorId": 4 }`. Ambos campos reemplazan lo anterior (`null` quita la asignación).
  La van debe existir y estar activa, y el conductor debe existir y estar activo; si no, responde 400.
- Cancelar: `{ "estado": "cancelado" }`. Las reservas pendientes del viaje pasan a `cancelada`.

Responde `{ "viaje": {...} }`. 400 si el cuerpo no es válido, 404 si el viaje no existe, 409 si no está pendiente.
Iniciar y finalizar son del conductor, no de la administración.

## Conductor (rol `conductor`)

Solo ve y modifica los viajes con `conductorId` igual a su cuenta.

### GET /api/conductor/viajes
Todos sus viajes (próximos e historial) con los pasajeros de cada uno.

### POST /api/conductor/viajes/:id/iniciar
`pendiente` → `en-curso`, guarda `iniciadoEn`. 409 si el viaje no está pendiente, no tiene van, o el conductor
(o la misma van) ya tiene un viaje en curso. 404 si el viaje no es suyo.

### POST /api/conductor/viajes/:id/finalizar
`en-curso` → `completado`, guarda `finalizadoEn` y pasa las reservas pendientes a `completada`. El viaje queda en su historial.

### GET /api/conductor/viajes/:id/ruta?lat=…&lon=…
Ruta por carretera desde la posición del conductor hasta la **sede de destino del viaje** (el destino sale de la base,
no del cliente). Solo para un viaje propio `en-curso`.

```json
{ "ruta": { "coordenadas": [[-33.01, -71.54], [-33.43, -70.63]], "distanciaM": 120500, "duracionS": 5400 } }
```

Usa openrouteservice con la clave `ORS_API_KEY` (solo en el backend, ver `backend/.env.example`). Para respetar los límites del
proveedor: posiciones a ~110 m comparten la ruta durante 60 s, un viaje no pide otra ruta antes de 15 s y el backend hace
como máximo 30 consultas por minuto.

| Código | Cuándo |
|---|---|
| 400 | Posición ausente o fuera de rango |
| 404 / 409 | Viaje ajeno / viaje que no está en curso |
| 429 | Demasiadas consultas: reintentar más tarde |
| 502 / 504 | El proveedor falló o no respondió |
| 503 | `ORS_API_KEY` sin configurar |
