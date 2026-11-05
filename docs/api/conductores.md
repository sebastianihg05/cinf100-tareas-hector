# API de conductores

Datos de conductor de las cuentas con rol `conductor`: RUT, vencimiento de la licencia y si está activo.
El nombre, el correo y el celular vienen de la cuenta (tabla `usuarios`).
Se guardan en la tabla `conductores` (migración `003_conductores.sql`).

Al aprobar una solicitud con rol `conductor` (`POST /api/admin/solicitudes/:id/aprobar`) se crea su registro,
sin RUT ni licencia, para que el administrador los complete.

Todas las rutas exigen sesión de administrador (`Authorization: Bearer <token>`).

## GET /api/admin/conductores

```json
{
  "conductores": [
    {
      "id": 4,
      "nombreCompleto": "Conductor Aprobado",
      "correo": "dev.conductor@unab.cl",
      "telefono": "+56900000003",
      "estado": "aprobada",
      "rut": "13.987.654-7",
      "licenciaHasta": "2027-09-06",
      "activo": true
    }
  ]
}
```

`rut` y `licenciaHasta` son `null` hasta que el administrador los registra.

## PATCH /api/admin/conductores/:id

Cuerpo con uno o más de estos campos:

| Campo | Tipo | Regla |
|---|---|---|
| `rut` | string | RUT válido (dígito verificador). Se guarda como `12.345.678-5`. |
| `licenciaHasta` | string | Fecha `AAAA-MM-DD`. |
| `activo` | boolean | `false` lo da de baja. |

Respuestas:

| Código | Cuándo |
|---|---|
| 200 | `{ "conductor": { ... } }` con los datos actualizados |
| 400 | Id inválido, cuerpo vacío o `{ "errores": { campo: mensaje } }` |
| 404 | El conductor no existe |
| 409 | `{ "errores": { "rut": "Ya existe un conductor con ese RUT." } }` |
