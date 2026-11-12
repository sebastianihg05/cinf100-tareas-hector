# S3-BD-01 — Modelo de vans

## 1. Objetivo

Documentar la tabla `vans` del proyecto CINF100 Grupo 02 (PostgreSQL 16), donde se guardan las vans del transporte institucional y el conductor asignado a cada una. Reemplaza a las vans que hoy viven en el navegador (`localStorage`) y es la base de la API de vans (#2600), del panel administrativo de vans (#2601) y de la asignación de vans a los viajes (#2602).

## 2. Decisiones

- **Reutiliza `conductores`.** El conductor de una van es una fila de `conductores` (003), no un dato repetido.
- **Las mismas reglas del frontend** (`adminStore.ts`):
  - un conductor maneja una sola van;
  - al dar de baja una van se libera su conductor;
  - al dar de baja un conductor se libera su van.
- **Las vans no se borran, se dan de baja** (`activa = false`). Así sus viajes conservan el historial.
- **Capacidad de la Hyundai Staria:** 9 asientos reservables, el mismo tope que `reservas.asiento` (1 a 9). El copiloto no se reserva.
- **Patente con el formato que guarda el frontend** (`normalizarPatente`): mayúsculas y guion, `FG-1251` o `BBCD-12`.

## 3. Campos

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `INTEGER IDENTITY` | Sí | Identificador único autoincremental y clave primaria. |
| `patente` | `VARCHAR(7)` | Sí | Patente única, por ejemplo `FG-1251` o `BBCD-12`. |
| `capacidad` | `SMALLINT` | Sí | Asientos reservables, de 1 a 9. Por defecto 9. |
| `activa` | `BOOLEAN` | Sí | `false` cuando la van está dada de baja. Por defecto `true`. |
| `conductor_id` | `INTEGER` | No | Conductor asignado (clave foránea a `conductores.usuario_id`). `NULL` mientras no se asigna. |
| `creado_en` | `TIMESTAMPTZ` | Sí | Fecha y hora de creación, generadas por PostgreSQL. |
| `actualizado_en` | `TIMESTAMPTZ` | Sí | Fecha y hora del último cambio, actualizada por un trigger. |

## 4. Validaciones implementadas

| Regla | Cómo se aplica |
|---|---|
| Patente con formato `AA-1234` o `AAAA-12` | `vans_patente_formato_check` |
| Patente sin duplicados | `vans_patente_unique` |
| Capacidad entre 1 y 9 | `vans_capacidad_check` |
| El conductor existe | `vans_conductor_id_fkey` |
| Un conductor en una sola van | `vans_conductor_unique` (índice único parcial) |
| No se asigna un conductor dado de baja | Trigger `vans_conductor_activo` (error `vans_conductor_activo_check`) |
| Una van dada de baja no tiene conductor | `vans_baja_sin_conductor_check` |
| Al dar de baja un conductor, su van queda libre | Trigger `conductores_baja_libera_van` |
| Si se borra la cuenta del conductor, la van se conserva sin conductor | `ON DELETE SET NULL` |

## 5. Relación con los viajes

La migración agrega la llave foránea que `004_viajes.sql` dejó pendiente:

```sql
ALTER TABLE viajes ADD CONSTRAINT viajes_van_id_fkey
    FOREIGN KEY (van_id) REFERENCES vans (id) ON DELETE RESTRICT;
```

- Un viaje solo puede apuntar a una van que existe.
- Una van con viajes no se puede borrar; se da de baja.
- Se agrega el índice `viajes_van_idx` para buscar los viajes de una van.

Que la van esté activa y libre en ese horario al asignarla a un viaje lo valida el backend (#2602), igual que hoy lo hace la pantalla «Asignar van».

## 6. Implementación y pruebas

| Archivo | Contenido |
|---|---|
| `database/migrations/006_vans.sql` | Tabla, restricciones, índices, triggers y llave foránea de `viajes.van_id`. |
| `database/tests/vans_restricciones.sql` | 20 pruebas de las restricciones, dentro de una transacción que se revierte. |
| `database/tests/viajes_restricciones.sql` | Ajustado: sus casos usan una van real en vez de `van_id = 1`. |
| `backend/tests/database.test.ts` | Comprueba que `006_vans.sql` está aplicada y que la base rechaza una patente sin guion. |

```bash
docker compose exec database psql -U devhub -d cinf100 -f /database/tests/vans_restricciones.sql
```

Debe terminar con `Todas las pruebas pasaron (20 de 20)`. El CI las ejecuta en cada push.

Verificado el 12-11-2026:

- **Base limpia:** en un PostgreSQL 16 nuevo se aplican las migraciones 001 a 006 y los seeds sin errores, y pasan las 85 pruebas SQL (23 de usuarios, 21 de viajes, 21 de reservas y 20 de vans).
- **Persistencia:** una van guardada sigue en la base después de `docker compose restart database`.
- **Backend:** pasan las 62 pruebas de `npm test`.

Los datos de ejemplo de vans para desarrollo quedan para S3-BD-04 (#2599).
