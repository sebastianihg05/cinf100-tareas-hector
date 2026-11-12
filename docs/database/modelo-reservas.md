# S3-BD-03 — Modelo de reservas y asientos

## 1. Objetivo

Documentar la tabla `reservas` del proyecto CINF100 Grupo 02 (PostgreSQL 16), donde se guardan los asientos que reservan los funcionarios en cada viaje. Reemplaza a las reservas que hoy viven en el navegador (`localStorage`) y es la base de las tareas #2605, #2606, #2607 y #2608.

## 2. Decisiones

- **Una fila por asiento.** Una reserva de ida y vuelta son dos filas, una por viaje, que comparten `grupo_id`. Es el mismo modelo que ya usa el frontend (`Reserva.grupoId`), así la integración no cambia las pantallas.
- **El trayecto no se repite en la reserva.** Cada viaje ya es de Ida o de Vuelta (`viajes.trayecto`), así que la reserva lo obtiene del viaje.
- **Asientos 1 a 9.** La Hyundai Staria tiene 9 plazas reservables, igual que `CAPACIDAD_VAN` y `MapaAsientos` del frontend. El copiloto no lleva número, por lo que no se puede reservar. Si una van tiene menos asientos, el backend valida contra su capacidad (#2606).
- **Las reservas no se borran, se cancelan.** Así se conserva el historial y el asiento queda libre para otros funcionarios.
- **La base de datos impide los choques.** Los índices únicos parciales rechazan el mismo asiento en dos reservas activas, aunque dos funcionarios reserven al mismo tiempo. El backend solo traduce ese error a un 409.

## 3. Campos

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `INTEGER IDENTITY` | Sí | Identificador único autoincremental y clave primaria. |
| `grupo_id` | `UUID` | Sí | Agrupa los trayectos de una misma reserva (ida y vuelta). |
| `usuario_id` | `INTEGER` | Sí | Funcionario que reserva (clave foránea a `usuarios.id`). |
| `viaje_id` | `INTEGER` | Sí | Viaje reservado (clave foránea a `viajes.id`). |
| `asiento` | `SMALLINT` | Sí | Número de asiento, de 1 a 9. |
| `estado` | `VARCHAR(20)` | Sí | `pendiente`, `completada` o `cancelada`. Inicia en `pendiente`. |
| `cancelada_en` | `TIMESTAMPTZ` | No | Fecha y hora de la cancelación. Solo la tienen las canceladas. |
| `creado_en` | `TIMESTAMPTZ` | Sí | Fecha y hora de la reserva, generadas por PostgreSQL. |
| `actualizado_en` | `TIMESTAMPTZ` | Sí | Fecha y hora del último cambio, actualizada por un trigger. |

## 4. Estados

| Estado | Significado | ¿Ocupa el asiento? |
|---|---|---|
| `pendiente` | Reserva vigente de un viaje que todavía no termina. | Sí |
| `completada` | El viaje terminó con el pasajero a bordo. | Sí |
| `cancelada` | El funcionario o la administración la cancelaron. | No |

Una reserva activa es la que no está cancelada, igual que `estaActiva` en el frontend.

## 5. Validaciones implementadas

- El asiento es un número entre 1 y 9.
- El estado solo puede ser `pendiente`, `completada` o `cancelada`.
- Una reserva cancelada tiene `cancelada_en`, y una no cancelada no lo tiene.
- Un asiento no se repite entre las reservas activas de un mismo viaje (`reservas_asiento_activo_unique`).
- Una persona tiene como máximo una reserva activa por viaje (`reservas_usuario_viaje_activo_unique`).
- Un mismo grupo no repite viaje (`reservas_grupo_viaje_unique`).
- No se puede reservar con un usuario o un viaje que no existen.
- Un viaje con reservas no se puede borrar (`ON DELETE RESTRICT`): se cancela y el historial se conserva.
- Al borrar una cuenta se borran sus reservas (`ON DELETE CASCADE`), igual que hoy en el panel del administrador.

Las reglas que dependen de otros datos las valida el backend (#2606 y #2607):

- El asiento no supera la capacidad de la van del viaje.
- El viaje está `pendiente`, tiene van asignada y no ha salido.
- Quien reserva es un funcionario aprobado.
- Solo se cancela o cambia una reserva propia y `pendiente`.

## 6. Índices

| Índice | Uso |
|---|---|
| `reservas_asiento_activo_unique` | Asientos ocupados de un viaje y bloqueo de duplicados. |
| `reservas_usuario_viaje_activo_unique` | Evita dos reservas activas de la misma persona en un viaje. |
| `reservas_usuario_idx` | «Mis reservas» del funcionario. |
| `reservas_grupo_idx` | Trayectos de una misma reserva. |

## 7. Relación con los viajes

Cada reserva apunta a un viaje de la tabla `viajes` (`004_viajes.sql`, ver `modelo-viajes.md`). De ahí salen la fecha, la hora y el trayecto de cada reserva, y si el viaje ya salió.

Cuando un viaje se complete o se cancele, sus reservas pendientes deberían pasar a `completada` o `cancelada` (#2603).

## 8. Implementación y pruebas

| Archivo | Contenido |
|---|---|
| `database/migrations/005_reservas.sql` | Tabla, restricciones, índices y trigger. |
| `database/tests/reservas_restricciones.sql` | 21 pruebas de las restricciones, dentro de una transacción que se revierte. También corren en el CI. |
| `backend/tests/database.test.ts` | Comprueba que las migraciones 004 y 005 están aplicadas y que se rechaza el asiento 10. |

Ejecutar las pruebas (con los contenedores levantados):

```bash
docker compose exec database psql -U devhub -d cinf100 -f /database/tests/reservas_restricciones.sql
```

Debe terminar con `Todas las pruebas pasaron (21 de 21)`.
