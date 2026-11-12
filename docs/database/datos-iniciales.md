# S3-BD-04 — Datos iniciales y validación de migraciones

## 1. Objetivo

Dejar datos de prueba para desarrollo de las tablas `vans`, `viajes` y `reservas`, y comprobar que las migraciones funcionan desde una base limpia con relaciones válidas entre conductores, vans, viajes y reservas.

## 2. Archivos

| Archivo | Contenido |
|---|---|
| `database/seeds/003_vans_dev.sql` | Las 3 vans de prueba, con las mismas patentes que el frontend. |
| `database/seeds/004_viajes_reservas_dev.sql` | 6 viajes y 4 reservas que cubren los estados principales. |
| `database/tests/datos_iniciales.sql` | 16 comprobaciones de los datos iniciales. También corre en el CI. |

Los seeds se cargan después de `001_usuarios_dev.sql` y `002_conductores_dev.sql`, porque usan sus cuentas de prueba.

## 3. Escenarios

**Vans**

| Patente | Estado | Conductor |
|---|---|---|
| `FG-1251` | activa | `dev.conductor@unab.cl` |
| `SH-8568` | activa | sin conductor |
| `CO-6768` | dada de baja | sin conductor |

**Viajes y reservas** (D = día en que se cargan los datos)

| Viaje | Estado | Van y conductor | Reserva de `dev.funcionario@unab.cl` |
|---|---|---|---|
| D-2 Ida | completado, con hora de inicio y término | FG-1251, conductor de prueba | asiento 4, completada |
| D-1 Vuelta | cancelado | — | asiento 2, cancelada |
| D+2 Ida | pendiente | FG-1251, conductor de prueba | asiento 3 (ida y vuelta, mismo grupo) |
| D+2 Vuelta | pendiente | FG-1251, conductor de prueba | asiento 5 (ida y vuelta, mismo grupo) |
| D+3 Ida | pendiente | sin asignar | — |
| D+5 Ida | pendiente | SH-8568, sin conductor | — |

Las fechas son relativas para que siempre haya viajes próximos que reservar.

## 4. Volver a ejecutarlos

Los seeds corren en cada `docker compose up -d`, así que no deben duplicar nada:

- **Vans:** se insertan solo las patentes que faltan. El conductor de prueba se asigna solo si la van no tiene conductor, él sigue activo y no maneja otra van. Así no se pisa lo que haya cambiado el administrador.
- **Viajes y reservas:** se cargan **solo si la tabla `viajes` está vacía**. Si el equipo ya creó viajes, el seed avisa `seed de viajes omitido` y no los mezcla.

Para recargar todo desde cero (borra todos los datos locales):

```bash
docker compose down -v
docker compose up -d
```

## 5. Procedimiento de validación

1. Levantar la base y aplicar migraciones y seeds:

   ```bash
   docker compose up -d
   docker compose logs migrate
   ```

   Debe mostrar las migraciones 001 a 006, los seeds 001 a 004 y `Base de datos lista.`

2. Comprobar los datos iniciales:

   ```bash
   docker compose exec database psql -U devhub -d cinf100 -f /database/tests/datos_iniciales.sql
   ```

   Debe terminar con `Todas las comprobaciones pasaron (16 de 16)`.

   - **Escenarios:** están las 3 vans, los viajes completados, cancelados y pendientes (con y sin van), las reservas en sus 3 estados y una reserva de ida y vuelta.
   - **Relaciones:**
     - un conductor maneja como máximo una van;
     - ningún viaje próximo usa una van dada de baja;
     - el conductor del viaje es el de su van;
     - ningún asiento supera la capacidad de la van;
     - no hay reservas activas en viajes cancelados;
     - las reservas completadas son de viajes completados;
     - las reservas son de funcionarios aprobados;
     - cada ida y vuelta es del mismo funcionario y del mismo día.
   - **Repetición:** volver a cargar los seeds no cambia la cantidad de vans, viajes ni reservas.

3. Comprobar las restricciones (casos de error):

   ```bash
   docker compose exec database psql -U devhub -d cinf100 -f /database/tests/usuarios_restricciones.sql
   docker compose exec database psql -U devhub -d cinf100 -f /database/tests/viajes_restricciones.sql
   docker compose exec database psql -U devhub -d cinf100 -f /database/tests/reservas_restricciones.sql
   docker compose exec database psql -U devhub -d cinf100 -f /database/tests/vans_restricciones.sql
   ```

4. Comprobar la persistencia: `docker compose restart database` y volver a contar las filas.

## 6. Resultados (12-11-2026)

Verificado en un PostgreSQL 16 nuevo, sin datos previos:

| Comprobación | Resultado |
|---|---|
| Migraciones 001 a 006 y seeds 001 a 004 sobre base limpia | Sin errores |
| Segunda carga de los seeds | Sin duplicados: 3 vans, 6 viajes, 4 reservas; los viajes avisan `seed de viajes omitido` |
| Pruebas de restricciones | 87 de 87 (usuarios 23, viajes 23, reservas 21, vans 20) |
| Comprobaciones de datos iniciales | 16 de 16 |
| Después de reiniciar PostgreSQL | Se conservan 3 vans, 6 viajes y 4 reservas |

Casos de error probados sobre los datos sembrados (la base los rechaza):

| Intento | Restricción que lo rechaza |
|---|---|
| Reservar un asiento ya ocupado en un viaje próximo | `reservas_asiento_activo_unique` |
| Asignar a SH-8568 el conductor que ya maneja FG-1251 | `vans_conductor_unique` |
| Borrar la van FG-1251, que tiene viajes | `viajes_van_id_fkey` |
| Borrar un viaje que tiene reservas | `reservas_viaje_id_fkey` |
| Dar de baja FG-1251 sin quitarle el conductor | `vans_baja_sin_conductor_check` |

## 7. Límites

- El frontend todavía usa sus propios datos en el navegador (`localStorage`). Estos datos se verán en las pantallas cuando se integren las APIs (#2601, #2604 y #2608).
- Solo hay un conductor de prueba, así que solo FG-1251 tiene conductor.
