# Base de datos (PostgreSQL 16)

La base de datos corre en Docker. Un solo comando la deja lista: crea el
contenedor, aplica las migraciones pendientes y carga los usuarios de prueba.

## Levantar

Requisito: Docker Desktop (o Docker Engine con Compose v2).

```bash
docker compose up -d
```

El servicio `migrate` se ejecuta, aplica lo que falte y termina. Para ver qué hizo:

```bash
docker compose logs migrate
```

Debe terminar con `Base de datos lista.`

| Dato | Valor por defecto |
|---|---|
| Host | `localhost` (solo este computador) |
| Puerto | `5432` |
| Base de datos | `cinf100` |
| Usuario / contraseña | `devhub` / `devhub` (solo desarrollo) |

Para cambiar estos valores, copia `.env.example` como `.env` en la raíz del
repositorio. Las credenciales solo se aplican la primera vez que se crea el
volumen; para cambiarlas después hay que recrearlo (ver abajo).

## Comprobar que funciona

```bash
docker compose exec database psql -U devhub -d cinf100 -f /database/tests/usuarios_restricciones.sql
```

Corre 23 pruebas de las restricciones de `usuarios` dentro de una transacción
que se revierte, así que no deja datos. Debe terminar con
`Todas las pruebas pasaron (23 de 23)`.

Consultar los datos a mano:

```bash
docker compose exec database psql -U devhub -d cinf100
```

```sql
SELECT id, correo, sede, rol, estado_aprobacion FROM usuarios ORDER BY id;
SELECT * FROM schema_migrations;
```

Desde el backend: con `npm run dev` en `backend/`, la dirección
`http://localhost:3000/api/health` muestra si la API ve la base y qué
migraciones están aplicadas. Detalles en `backend/README.md`.

## Ver la base en el navegador (Adminer)

`docker compose up -d` también levanta **Adminer** en `http://localhost:8080`.
Para entrar:

| Campo | Valor |
|---|---|
| Sistema | **PostgreSQL** (viene marcado MySQL: hay que cambiarlo) |
| Servidor | `database` |
| Usuario | `devhub` |
| Contraseña | `devhub` |
| Base de datos | `cinf100` |

Ahí puedes ver las tablas, sus datos y su estructura, editar filas y ejecutar
SQL ("SQL command"). Los cambios que hagas son reales, igual que con `psql`.

## Estructura

| Carpeta | Contenido |
|---|---|
| `migrations/` | Cambios del esquema, numerados (`001_...sql`, `002_...sql`). Se aplican en orden y una sola vez. |
| `seeds/` | Datos de prueba para desarrollo. Se cargan en cada `up` y no duplican filas. |
| `tests/` | Pruebas SQL de las restricciones. |
| `migrate.sh` | Script que usa el servicio `migrate` para aplicar migraciones y seeds. |

Cada migración aplicada queda registrada en la tabla `schema_migrations`, y
se ejecuta dentro de una transacción: si falla, no queda a medias.

## Agregar una migración

1. Crea `database/migrations/003_descripcion.sql` con el siguiente número.
2. No modifiques una migración que ya se subió a `desa`: crea una nueva.
3. Ejecuta `docker compose up -d` y revisa `docker compose logs migrate`.

## Usuarios de prueba (seed)

| Correo | Rol | Estado | Sede |
|---|---|---|---|
| `dev.admin@unab.cl` | administrador | aprobada | — |
| `dev.funcionario@unab.cl` | funcionario | aprobada | Quillota 980 |
| `dev.conductor@unab.cl` | conductor | aprobada | Quillota 980 |
| `dev.pendiente@uandresbello.edu` | — | pendiente | Santiago |
| `dev.rechazado@unab.cl` | — | rechazada | Quintay |
| `dev.desactivado@unab.cl` | funcionario | desactivada | Rokamar |

La contraseña no está en el repositorio. Se toma de `SEED_PASSWORD` en el
`.env` de la raíz y se guarda como hash bcrypt. Si no se define, se usa una
contraseña aleatoria y nadie puede iniciar sesión con estas cuentas. Si la
defines o la cambias después, el siguiente `docker compose up -d` la aplica a
las cuentas de prueba que ya existían. `npm run dev` en la raíz genera una si
está vacía y la muestra al arrancar.
Para no cargar estos usuarios: `CARGAR_SEED=false`.

## Reiniciar y borrar

| Comando | Efecto |
|---|---|
| `docker compose stop` / `docker compose down` | Detiene los contenedores. **Los datos se conservan.** |
| `docker compose up -d` | Vuelve a levantar con los mismos datos. |
| `docker compose down -v` | **Borra el volumen y todos los datos.** El siguiente `up` crea la base desde cero. |

## Problemas frecuentes

- **`port is already allocated`**: ya hay un PostgreSQL usando el puerto 5432.
  Pon `POSTGRES_PORT=5433` en el `.env` de la raíz y usa ese puerto en `backend/.env`.
- **`password authentication failed`**: el volumen se creó con otras
  credenciales. Usa las originales o ejecuta `docker compose down -v`.
- **El servicio `migrate` terminó con error**: `docker compose logs migrate`
  muestra la migración y la línea que falló; nada de esa migración quedó aplicado.