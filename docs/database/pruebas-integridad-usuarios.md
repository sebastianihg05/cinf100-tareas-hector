# BD-05 — Pruebas de integridad de usuarios

## 1. Objetivo

Comprobar las restricciones de integridad de la tabla `usuarios` en PostgreSQL 16.

## 2. Cómo ejecutarlas

Con los contenedores levantados (`docker compose up -d`):

```bash
docker compose exec database psql -U devhub -d cinf100 -f /database/tests/usuarios_restricciones.sql
```

El archivo `database/tests/usuarios_restricciones.sql` ejecuta todos los casos dentro de una transacción que se revierte, muestra una tabla con el resultado de cada uno y termina con error si alguno falla.

## 3. Casos

| Caso | Resultado esperado |
|---|---|
| Registro válido con correo `@unab.cl` | Aceptado, queda `pendiente` y sin rol. |
| Registro válido con correo `@uandresbello.edu` | Aceptado. |
| Administrador sin sede | Aceptado. |
| Hash Argon2id | Aceptado. |
| Correo `@gmail.com` | Rechazado por `usuarios_correo_institucional_check`. |
| Correo con mayúsculas | Rechazado por `usuarios_correo_minusculas_check`. |
| Correo duplicado | Rechazado por `usuarios_correo_unique_ci`. |
| Nombre vacío o solo espacios | Rechazado por `usuarios_nombre_no_vacio_check`. |
| Nombre ausente | Rechazado por `NOT NULL`. |
| Contraseña en texto plano | Rechazado por `usuarios_hash_contrasena_check`. |
| Teléfono con letras o con espacios | Rechazado por `usuarios_telefono_check`. |
| Sede `Concepcion` | Rechazado por `usuarios_sede_check`. |
| Funcionario sin sede | Rechazado por `usuarios_sede_segun_rol_check`. |
| Administrador con sede | Rechazado por `usuarios_sede_segun_rol_check`. |
| Rol `supervisor` | Rechazado por `usuarios_rol_check`. |
| Estado `en_revision` | Rechazado por `usuarios_estado_check`. |
| Cuenta pendiente con rol | Rechazado por `usuarios_estado_rol_check`. |
| Cuenta aprobada sin rol | Rechazado por `usuarios_estado_rol_check`. |
| Cuenta pendiente con decisión registrada | Rechazado por `usuarios_decision_check`. |
| `id` escrito a mano | Rechazado por `GENERATED ALWAYS`. |
| Aprobar una cuenta | Guarda quién la aprobó y actualiza `actualizado_en`. |
| Un usuario se aprueba a sí mismo | Rechazado por `usuarios_no_autoaprobacion_check`. |

## 4. Resultado

Los 23 casos pasan con las migraciones 001 y 002 aplicadas: `Todas las pruebas pasaron (23 de 23)`.
