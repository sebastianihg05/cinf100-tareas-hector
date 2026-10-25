# BD-05 — Pruebas de integridad de usuarios

## 1. Objetivo

Registrar las pruebas manuales realizadas para comprobar las restricciones de integridad de la tabla `usuarios` en PostgreSQL 16.

## 2. Entorno de prueba

- Base de datos: `cinf100`.
- Tabla: `public.usuarios`.
- Migración: `database/migrations/001_create_usuarios.sql`.
- Entorno: PostgreSQL ejecutándose mediante Docker Compose.

## 3. Resultados

| Prueba | Resultado esperado | Resultado obtenido |
|---|---|---|
| Correo con dominio `gmail.com` | Rechazar correo no institucional. | Rechazado por `usuarios_correo_institucional_check`. |
| Sede `Concepcion` | Rechazar sede no permitida. | Rechazada por `usuarios_sede_check`. |
| Correo duplicado con diferencias de mayúsculas | Rechazar duplicados. | Rechazado por `usuarios_correo_unique_ci`. |
| Cuenta pendiente con rol `funcionario` | Rechazar combinación inválida. | Rechazada por `usuarios_estado_rol_check`. |
| Rol `supervisor` | Rechazar rol no definido. | Rechazado por `usuarios_rol_check`. |
| Estado `en_revision` | Rechazar estado no permitido. | Rechazado por `usuarios_estado_check`. |
| Registro sin `nombre_completo` | Rechazar campo obligatorio ausente. | Rechazado por la restricción `NOT NULL`. |
| Registro válido con correo institucional y sede permitida | Aceptar el registro y aplicar valores predeterminados. | Aceptado; asignó estado `pendiente` y rol nulo. Después se ejecutó `ROLLBACK`. |

## 4. Conclusión

Las pruebas manuales realizadas verificaron el funcionamiento de las restricciones de correo institucional, unicidad del correo, sedes, roles, estados y campos obligatorios.

También se verificó que un registro válido puede insertarse utilizando los valores predeterminados de la tabla. La transacción de prueba se revirtió para no conservar ese registro.

Estas comprobaciones son manuales; su automatización queda pendiente para una tarea posterior.
