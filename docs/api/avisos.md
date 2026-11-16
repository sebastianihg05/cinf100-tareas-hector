# API de avisos leídos

Avisos de la campana que cada persona ya marcó como leídos (S3-RES-04, #2608). Se guardan en la tabla
`avisos_leidos` (`007_avisos_leidos.sql`), así no queda nada de la campana en el navegador.

Los avisos en sí no se guardan: el frontend los arma con las reservas de `GET /api/reservas`
(ver `docs/api/reservas.md`). Cada aviso tiene un id fijo:

| Aviso | Id |
|---|---|
| Reserva confirmada | `confirmada:<grupoId>` |
| Tu viaje está en curso | `en-curso:<reservaId>` |
| Viaje cancelado por la administración | `cancelado:<reservaId>` |

Ambas rutas exigen sesión (cualquier rol). Cada persona solo ve y marca los suyos. Sin sesión: 401.

## GET /api/avisos/leidos

```json
{ "leidos": ["confirmada:2f0c4c4e-8a1d-4a53-9d3e-6a3f0f6e2b10", "cancelado:42"] }
```

## POST /api/avisos/leidos

```json
{ "ids": ["cancelado:42"] }
```

Marca de 1 a 50 avisos como leídos y responde la lista completa, igual que el GET. Marcar uno que ya estaba
leído no hace nada. Lista vacía, con más de 50 ids o con un id que no tiene el formato `tipo:id`: 400.

## Tabla avisos_leidos

| Columna | Tipo | Detalle |
|---|---|---|
| `usuario_id` | INTEGER | FK a `usuarios`, `ON DELETE CASCADE`: al borrar la cuenta se borran sus avisos leídos. |
| `aviso_id` | VARCHAR(80) | CHECK con el formato `tipo:id`. |
| `leido_en` | TIMESTAMPTZ | Cuándo se marcó. |

Llave primaria `(usuario_id, aviso_id)`: un aviso se marca una sola vez por persona.

## Pruebas

`backend/tests/avisos.test.ts` (4 pruebas contra PostgreSQL): acceso sin sesión, marcar sin repetir y solo los
propios, listas inválidas y borrado en cascada con la cuenta.
