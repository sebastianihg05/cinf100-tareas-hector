# API de reservas

Reservas de asientos de los funcionarios, guardadas en la tabla `reservas` (`005_reservas.sql`).
Una reserva de ida y vuelta son dos filas con el mismo `grupo_id`.

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

`backend/tests/reservas.test.ts` (14 pruebas contra PostgreSQL): acceso por rol, reserva de ida y de ida y
vuelta, asiento ocupado, reserva duplicada, reserva simultánea del mismo asiento, rollback de ida y vuelta,
datos inválidos, capacidad de la van, viajes no disponibles y ventana de 1 a 30 días.

`backend/tests/reservar-correo.test.ts` comprueba el correo de confirmación con una base simulada.

Pendiente en otras tareas: consulta de viajes y asientos ocupados (#2605) y cancelación y cambio de asiento (#2607).
