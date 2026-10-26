# BD-03 — Modelo de usuarios

## 1. Objetivo

Documentar la estructura de la tabla `usuarios` del proyecto CINF100 Grupo 02, implementada en PostgreSQL 16.

## 2. Campos

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `INTEGER IDENTITY` | Sí | Identificador único autoincremental y clave primaria. |
| `nombre_completo` | `VARCHAR(150)` | Sí | Nombre completo del usuario. No puede estar vacío. |
| `correo` | `VARCHAR(254)` | Sí | Correo institucional, guardado en minúsculas. |
| `hash_contrasena` | `VARCHAR(255)` | Sí | Hash bcrypt o Argon2id de la contraseña, nunca el texto plano. |
| `telefono` | `VARCHAR(16)` | Sí | Celular chileno con formato `+569XXXXXXXX`. |
| `sede` | `VARCHAR(30)` | Según rol | Sede del usuario. El administrador no tiene sede. |
| `rol` | `VARCHAR(20)` | No | Rol asignado por el administrador al aprobar la cuenta. |
| `estado_aprobacion` | `VARCHAR(20)` | Sí | Estado actual de la cuenta. Inicia en `pendiente`. |
| `decidido_por` | `INTEGER` | No | Administrador que aprobó o rechazó la cuenta (clave foránea a `usuarios.id`). |
| `decidido_en` | `TIMESTAMPTZ` | No | Fecha y hora de la aprobación o el rechazo. |
| `creado_en` | `TIMESTAMPTZ` | Sí | Fecha y hora de creación, generadas por PostgreSQL. |
| `actualizado_en` | `TIMESTAMPTZ` | Sí | Fecha y hora de la última modificación, actualizada por un trigger. |
| `ultimo_ingreso_en` | `TIMESTAMPTZ` | No | Fecha y hora del último ingreso exitoso. |

## 3. Validaciones implementadas

- El correo debe usar el dominio institucional `unab.cl` o `uandresbello.edu` y estar en minúsculas.
- Los correos duplicados se rechazan sin distinguir mayúsculas y minúsculas.
- El nombre no puede estar vacío ni tener solo espacios.
- La contraseña solo se acepta como hash bcrypt (`$2a$`, `$2b$`, `$2y$`) o Argon2id (`$argon2id$`).
- El teléfono debe tener el formato `+569XXXXXXXX`.
- Las sedes permitidas son `Quillota 980`, `Quintay`, `Rokamar` y `Santiago`.
- El administrador no tiene sede; los demás usuarios deben tenerla.
- Los roles permitidos son `administrador`, `funcionario` y `conductor`. El rol puede ser nulo.
- Los estados permitidos son `pendiente`, `aprobada`, `rechazada` y `desactivada`.
- Las cuentas pendientes o rechazadas no pueden tener rol. Las aprobadas o desactivadas deben tenerlo.
- Una cuenta pendiente no tiene decisión registrada (`decidido_por` y `decidido_en` vacíos).
- Un usuario no puede aprobarse ni rechazarse a sí mismo.

## 4. Implementación

| Migración | Contenido |
|---|---|
| `database/migrations/001_create_usuarios.sql` | Tabla inicial, clave primaria, restricciones de correo, sede, rol y estado, e índice único sobre `LOWER(correo)`. |
| `database/migrations/002_ajustes_usuarios.sql` | Correo en minúsculas, nombre y hash no vacíos, formato de teléfono, sede opcional para el administrador, `decidido_por`, `decidido_en`, `actualizado_en` con trigger e índice de solicitudes pendientes. |

El procedimiento para aplicarlas está en `database/README.md`.

## 5. Trabajo pendiente

Los datos específicos de conductores (RUT, licencia), el permiso para abrir viajes y la integración con el backend se abordarán en tareas posteriores.
