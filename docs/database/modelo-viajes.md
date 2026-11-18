# S3-BD-02 — Modelo de viajes

## 1. Objetivo

Documentar la tabla `viajes` del proyecto CINF100 Grupo 02 (PostgreSQL 16), donde se guardan los viajes del transporte institucional. Reemplaza a los viajes que hoy viven en el navegador (`localStorage`) y es la base de las reservas (#2598), la API de viajes (#2602 y #2603) y el panel del conductor (#2610).

## 2. Decisiones

- **Un viaje es un trayecto.** Una salida de ida y otra de vuelta del mismo día son dos viajes, igual que en el frontend (`Viaje.trayecto`).
- **Ruta y horario fijos.** La Ida sale a las 06:45 de Quillota 980 a Santiago, y la Vuelta a las 17:00 de Santiago a Quillota 980 (`RUTA_TRAYECTO` y `HORA_TRAYECTO` del frontend). La base rechaza cualquier otra combinación.
- **Un viaje activo por día y trayecto.** Es la misma regla que valida hoy «Abrir viaje». Un viaje cancelado no cuenta, así que ese día se puede abrir otro.
- **Los viajes no se borran, se cancelan.** Así se conserva el historial y sus reservas.
- **Trazabilidad.** Se guarda quién abrió el viaje y la fecha y hora de inicio, término y cancelación.
- **Estados con los mismos nombres del frontend:** `pendiente`, `en-curso`, `completado` y `cancelado`. Así la integración no cambia las pantallas.

## 3. Campos

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `INTEGER IDENTITY` | Sí | Identificador único autoincremental y clave primaria. |
| `fecha` | `DATE` | Sí | Día del viaje. |
| `hora` | `TIME` | Sí | Hora de salida: 06:45 la Ida y 17:00 la Vuelta. |
| `trayecto` | `VARCHAR(10)` | Sí | `Ida` o `Vuelta`. |
| `origen` | `VARCHAR(30)` | Sí | Sede de salida según el trayecto. |
| `destino` | `VARCHAR(30)` | Sí | Sede de llegada según el trayecto. |
| `van_id` | `INTEGER` | No | Van asignada (clave foránea a `vans.id`). `NULL` mientras la administración no la asigna. |
| `conductor_id` | `INTEGER` | No | Conductor asignado (clave foránea a `conductores.usuario_id`). |
| `estado` | `VARCHAR(20)` | Sí | `pendiente`, `en-curso`, `completado` o `cancelado`. Inicia en `pendiente`. |
| `creado_por` | `INTEGER` | No | Cuenta que abrió el viaje (clave foránea a `usuarios.id`). |
| `iniciado_en` | `TIMESTAMPTZ` | No | Fecha y hora en que el conductor inició el viaje. |
| `finalizado_en` | `TIMESTAMPTZ` | No | Fecha y hora en que el conductor lo terminó. |
| `cancelado_en` | `TIMESTAMPTZ` | No | Fecha y hora de la cancelación. |
| `creado_en` | `TIMESTAMPTZ` | Sí | Fecha y hora de creación, generadas por PostgreSQL. |
| `actualizado_en` | `TIMESTAMPTZ` | Sí | Fecha y hora del último cambio, actualizada por un trigger. |

## 4. Estados y fechas

| Estado | `iniciado_en` | `finalizado_en` | `cancelado_en` | Van y conductor |
|---|---|---|---|---|
| `pendiente` | vacío | vacío | vacío | Opcionales |
| `en-curso` | con fecha | vacío | vacío | Obligatorios |
| `completado` | con fecha | con fecha (igual o posterior al inicio) | vacío | Obligatorios |
| `cancelado` | opcional | vacío | con fecha | Opcionales |

Qué transición está permitida en cada momento (por ejemplo, que solo se inicie un viaje pendiente) y quién puede hacerla lo valida el backend en #2603.

## 5. Validaciones implementadas

- El trayecto solo puede ser `Ida` o `Vuelta`, con su ruta y horario fijos (`viajes_ruta_check`).
- El estado solo puede ser `pendiente`, `en-curso`, `completado` o `cancelado`.
- Un viaje no puede estar en curso ni completado sin van y conductor.
- Las fechas de inicio, término y cancelación calzan con el estado.
- El término no puede ser anterior al inicio.
- No hay dos viajes activos del mismo trayecto el mismo día (`viajes_fecha_trayecto_activo_unique`).
- El conductor y la cuenta que abrió el viaje deben existir. Si se borran, el viaje se conserva sin ese dato (`ON DELETE SET NULL`).
- La van asignada debe existir, y una van con viajes no se puede borrar (`viajes_van_id_fkey`).
- Un viaje con reservas no se puede borrar (lo impide la tabla `reservas`).

## 6. Relación con las vans (#2596)

La migración de vans (`006_vans.sql`) agregó la llave foránea `viajes_van_id_fkey` (`ON DELETE RESTRICT`): un viaje solo apunta a una van existente y una van con viajes no se borra. Detalles en `modelo-vans.md`.

Que la van esté activa al asignarla lo valida el backend (#2602).

## 7. Historial de estados (008 y 009)

`viajes_historial_estados` guarda cada cambio de estado de un viaje:

| Columna | Detalle |
|---|---|
| `viaje_id` | FK a `viajes`, `ON DELETE CASCADE`. |
| `estado_anterior`, `estado_nuevo` | Solo las transiciones válidas: `pendiente → en-curso`, `pendiente → cancelado` y `en-curso → completado`. |
| `usuario_id` | Quién hizo el cambio. FK a `usuarios` con `ON DELETE SET NULL` (009): al borrar la cuenta, el historial se conserva sin el usuario, igual que `viajes.creado_por`. |
| `fecha_hora` | Cuándo se hizo. Índice por `(viaje_id, fecha_hora)`. |

Las filas las escriben `POST /api/conductor/viajes/:id/iniciar`, `.../finalizar` y `PATCH /api/admin/viajes/:id`
(cancelar), dentro de la misma transacción que el cambio. Pruebas en `backend/tests/viajes.test.ts`.

## 8. Implementación y pruebas

| Archivo | Contenido |
|---|---|
| `database/migrations/004_viajes.sql` | Tabla, restricciones, índices y trigger. |
| `database/migrations/008_historial_estados_viajes.sql` y `009_historial_usuario_set_null.sql` | Historial de estados. |
| `database/tests/viajes_restricciones.sql` | 23 pruebas de las restricciones, dentro de una transacción que se revierte. |

```bash
docker compose exec database psql -U devhub -d cinf100 -f /database/tests/viajes_restricciones.sql
```

Debe terminar con `Todas las pruebas pasaron (23 de 23)`. El CI las ejecuta en cada push.

Los viajes quedan en el volumen de PostgreSQL, así que se mantienen al reiniciar los servicios. Se comprobó creando un viaje con su van, reiniciando el contenedor (`docker compose restart database`) y consultándolo de nuevo.
