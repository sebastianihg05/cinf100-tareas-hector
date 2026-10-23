# BD-03 — Modelo inicial de usuarios

## 1. Objetivo

Documentar la estructura inicial de la tabla `usuarios` del proyecto CINF100 Grupo 02, implementada en PostgreSQL 16.

## 2. Campos

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `INTEGER IDENTITY` | Sí | Identificador único autoincremental y clave primaria. |
| `nombre_completo` | `VARCHAR(150)` | Sí | Nombre completo del usuario. |
| `correo` | `VARCHAR(254)` | Sí | Correo institucional. |
| `hash_contrasena` | `VARCHAR(255)` | Sí | Hash de la contraseña, no la contraseña en texto plano. |
| `telefono` | `VARCHAR(16)` | Sí | Teléfono de contacto. |
| `sede` | `VARCHAR(30)` | Sí | Sede asociada al usuario. |
| `rol` | `VARCHAR(20)` | No | Rol asignado a la cuenta. |
| `estado_aprobacion` | `VARCHAR(20)` | Sí | Estado actual de la cuenta. |
| `creado_en` | `TIMESTAMPTZ` | Sí | Fecha y hora de creación, generadas por PostgreSQL. |
| `ultimo_ingreso_en` | `TIMESTAMPTZ` | No | Fecha y hora del último ingreso exitoso. |

## 3. Validaciones implementadas

- El correo debe utilizar el dominio institucional `unab.cl` o `uandresbello.edu`.
- Los correos duplicados se rechazan sin distinguir mayúsculas y minúsculas.
- Las sedes permitidas son `Quillota 980`, `Quintay`, `Rokamar` y `Santiago`.
- Los roles permitidos son `administrador`, `funcionario` y `conductor`. El rol puede ser nulo.
- Los estados permitidos son `pendiente`, `aprobada`, `rechazada` y `desactivada`.
- Las cuentas pendientes o rechazadas no pueden tener un rol asignado. Las aprobadas o desactivadas deben tenerlo.
- El estado inicial de una cuenta es `pendiente`.
- La fecha de creación se establece automáticamente mediante PostgreSQL.

## 4. Alcance actual

La tabla se crea mediante la migración `database/migrations/001_create_usuarios.sql`.

La migración incluye la clave primaria, restricciones de validación y un índice único para el correo.

Este modelo es una primera versión y no representa todavía la implementación completa de autenticación o autorización del sistema.

## 5. Trabajo pendiente

La actualización automática de fechas de modificación, el registro de decisiones administrativas, los datos específicos de conductores y la integración con el backend se abordarán en tareas posteriores.