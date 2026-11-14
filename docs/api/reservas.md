# API de reservas

Reservas de asientos de los funcionarios, guardadas en la tabla `reservas` (`005_reservas.sql`).
Una reserva de ida y vuelta son dos filas con el mismo `grupo_id`.

## Consultar viajes y asientos (S3-RES-01, #2605)

Ambas rutas exigen sesión de **funcionario**. Un viaje es reservable con las mismas reglas que revisa
`POST /api/reservas`: estado `pendiente`, con una van activa y de 1 a 30 días desde hoy (fecha de Chile).
Un asiento está ocupado mientras su reserva no esté cancelada.

### GET /api/viajes/disponibles

Viajes reservables, del más cercano al más lejano. Filtros opcionales: `?fecha=AAAA-MM-DD` y `?trayecto=Ida|Vuelta`.

```json
{
  "viajes": [
    { "id": 12, "fecha": "2026-11-20", "hora": "06:45", "trayecto": "Ida",
      "origen": "Quillota 980", "destino": "Santiago",
      "capacidad": 9, "ocupados": 3, "libres": 6, "tengoReserva": false }
  ]
}
```

- `tengoReserva`: la persona ya tiene una reserva activa en ese viaje.
- Sin resultados responde `200` con `"viajes": []`.
- Filtros inválidos (fecha que no existe, trayecto distinto de `Ida` o `Vuelta`): `400 { "errores": { campo: mensaje } }`.

### GET /api/viajes/:id/asientos

```json
{ "viajeId": 12, "capacidad": 9, "ocupados": [1, 4, 7], "miAsiento": 4 }
```

- `ocupados` va de menor a mayor. `miAsiento` es el asiento propio en ese viaje, o `null`.
- Id inválido: 400. Viaje inexistente: 404. Viaje que ya no se puede reservar: 409.

## POST /api/reservas (S3-RES-02, #2606)

Crea una reserva de ida, de vuelta o de ida y vuelta. Exige sesión de **funcionario** con la cuenta aprobada
(`Authorization: Bearer <token>`).

```json
{
  "solicitudes": [
    { "viajeId": 12, "asiento": 3 },
    { "viajeId": 13, "asiento": 5 }
  ]
}
```

### Reglas

| Regla | Si no se cumple |
|---|---|
| 1 o 2 solicitudes, cada una con `viajeId` y `asiento` enteros, sin repetir viaje. | 400 |
| Con 2 solicitudes: una ida y una vuelta del mismo día. | 400 |
| El asiento existe en la van del viaje (1 a su capacidad, máximo 9 en la Hyundai Staria). | 400 |
| El viaje existe. | 404 |
| El viaje está `pendiente`, tiene una van activa y es de 1 a 30 días desde hoy (fecha de Chile). | 409 |
| El asiento está libre en ese viaje. | 409 `El asiento ya fue reservado por otra persona. Elige otro.` |
| La persona no tiene otra reserva activa en ese viaje. | 409 `Ya tienes una reserva en este viaje.` |

Todo va en una transacción: con ida y vuelta se guardan **las dos o ninguna**.

Si dos funcionarios piden el mismo asiento al mismo tiempo, los índices únicos de `005_reservas.sql`
dejan pasar solo a uno y el otro recibe el 409. Los viajes se bloquean en orden de id, así dos reservas
de ida y vuelta simultáneas no se quedan esperando entre sí.

### Respuesta 201

```json
{
  "grupoId": "2f0c4c4e-8a1d-4a53-9d3e-6a3f0f6e2b10",
  "reservas": [
    { "id": 41, "viajeId": 12, "asiento": 3, "fecha": "2026-11-20", "hora": "06:45",
      "trayecto": "Ida", "origen": "Quillota 980", "destino": "Santiago" },
    { "id": 42, "viajeId": 13, "asiento": 5, "fecha": "2026-11-20", "hora": "17:00",
      "trayecto": "Vuelta", "origen": "Santiago", "destino": "Quillota 980" }
  ]
}
```

Después de guardar se envía el correo de confirmación (NOT-03, #2318). Si el correo falla, la reserva
se mantiene y el error queda registrado en la consola del backend.

### Errores

Todos responden `{ "error": "mensaje" }`. Sin sesión: 401. Con otro rol: 403.

## Pruebas

`backend/tests/reservas.test.ts` (23 pruebas contra PostgreSQL; 9 son de las consultas de #2605): acceso por rol, reserva de ida y de ida y
vuelta, asiento ocupado, reserva duplicada, reserva simultánea del mismo asiento, rollback de ida y vuelta,
datos inválidos, capacidad de la van, viajes no disponibles y ventana de 1 a 30 días.

`backend/tests/reservar-correo.test.ts` comprueba el correo de confirmación con una base simulada.

Pendiente en otra tarea: cancelación y cambio de asiento (#2607).
