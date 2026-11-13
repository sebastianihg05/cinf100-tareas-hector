# Viajes con API y navegación GPS

Cambios de las tareas **S3-VIA-03**, **S3-CON-02** y **GPS-03 a GPS-08**. Además se verificó que **ASI-02** (mapa de asientos de la Hyundai Staria) y **ASI-03** (asiento del copiloto bloqueado) ya estaban implementadas y con pruebas.

## Resumen

| Tarea | Qué cambia |
| --- | --- |
| S3-VIA-03 | El administrador abre, asigna van y conductor, y cancela viajes contra la API. La lista se sincroniza con la base cada 15 s. |
| S3-CON-02 | El conductor ve sus viajes desde la base, inicia y finaliza el viaje contra la API, y consulta el historial. |
| GPS-03 | Pantalla de navegación `/conductor/viajes/:viajeId/navegacion` con mapa (React Leaflet y OpenStreetMap). |
| GPS-04 | Seguimiento de la ubicación con `watchPosition`: permiso denegado, sin señal y sin soporte. |
| GPS-05 | Ruta hasta la sede de destino calculada por el backend con openrouteservice. |
| GPS-06 | Distancia restante, tiempo restante, hora estimada de llegada y recálculo por desvío. |
| GPS-07 | La navegación solo se abre con el viaje **En curso**. Al finalizar el viaje se detiene el seguimiento. |
| GPS-08 | Pruebas automáticas y plan de pruebas manuales (`docs/gps/pruebas-gps.md`). |

## Cómo probarlo

1. `npm install` y luego `npm run dev` en la raíz del repositorio.
2. Abrir `http://localhost:5173` e iniciar sesión con las cuentas de prueba. La contraseña está en `SEED_PASSWORD` del archivo `.env` de la raíz.
   - `dev.admin@unab.cl`: Viajes.
   - `dev.conductor@unab.cl`: Mis viajes → Iniciar viaje → **Abrir navegación**.
   - `dev.funcionario@unab.cl`: Reservar.
3. Para dibujar la ruta, poner la clave de openrouteservice en `ORS_API_KEY` de `backend/.env` (se obtiene gratis en openrouteservice.org). Sin la clave, el mapa muestra la posición y avisa que no hay ruta.
4. Para simular el GPS en el computador: herramientas de Chrome (F12) → `Ctrl+Shift+P` → "Show Sensors" → Location.

Los viajes de prueba de `dev.conductor` (uno completado, ida y vuelta próximas, con reservas y la van FG-1251) los crea el seed `database/seeds/004_viajes_reservas_dev.sql` (#2599). Ese seed solo se carga si la tabla `viajes` está vacía: si la base local ya tenía otros viajes, para partir de cero se usa `docker compose down -v` y luego `npm run dev` (borra los datos locales).

## API nueva

Detalle en `docs/api/viajes.md`.

| Método y ruta | Rol | Uso |
| --- | --- | --- |
| `GET /api/admin/viajes` | administrador | Lista los viajes con sus reservas. |
| `POST /api/admin/viajes` | administrador | Abre viajes `{ fecha, trayectos }`. La fecha debe estar entre 1 y 30 días desde hoy. |
| `PATCH /api/admin/viajes/:id` | administrador | Asigna `{ vanId, conductorId }` (van y conductor activos) o cancela `{ estado: 'cancelado' }`. Solo sobre viajes pendientes. |
| `GET /api/conductor/viajes` | conductor | Viajes asignados al conductor. |
| `POST /api/conductor/viajes/:id/iniciar` | conductor | Pasa el viaje a En curso (exige van y un solo viaje en curso por conductor y por van). |
| `POST /api/conductor/viajes/:id/finalizar` | conductor | Completa el viaje y sus reservas pendientes. |
| `GET /api/conductor/viajes/:id/ruta?lat&lon` | conductor | Ruta hasta el destino del viaje. El destino lo decide el servidor. |

Límites del cálculo de ruta: la clave queda solo en el backend, como máximo 1 consulta cada 15 s por viaje y 30 por minuto, y se reutilizan durante 60 s las rutas pedidas desde una posición cercana (unos 110 m). En el frontend, la ruta solo se recalcula si el conductor se aleja más de 200 m durante dos lecturas seguidas, con al menos 30 s entre recálculos.

## Archivos principales

| Ruta | Contenido |
| --- | --- |
| `backend/src/admin/viajes.ts`, `backend/src/conductor/rutas.ts`, `backend/src/viajes/` | Rutas de la API, modelo, sedes y cliente de openrouteservice. |
| `backend/tests/viajes.test.ts` | Pruebas de la API. |
| `frontend/src/admin/store/useViajesBd.tsx`, `viajesBd.ts` | Sincronización de los viajes de la base con el estado de la app. |
| `frontend/src/gps/` | Cálculos, seguimiento de ubicación, ruta, mapa y sus pruebas. |
| `frontend/src/conductor/pages/NavegacionViaje.tsx` | Pantalla de navegación. |
| `frontend/src/styles/conductor.css` | Estilos `cnd-nav*`, `cnd-mapa*` y `cnd-marcador*`. |

## Pruebas

```powershell
cd frontend; npm test; npx tsc -b; npm run build
cd ..\backend; npm test
```

Las pruebas usan Node 22, como el CI. Con Node 25 o superior hay que ejecutar antes `$env:NODE_OPTIONS = "--no-experimental-webstorage"`.

## Pendientes y limitaciones

- **Reservas del pasajero:** todavía se guardan solo en su navegador, porque aún no hay API para escribirlas. Por eso el conductor no ve las reservas hechas desde otro dispositivo.
- **Vans:** las vans de la app siguen siendo locales y se envían como `vanId` con un número derivado de su id (`v1` → 1, que corresponde a FG-1251). Funciona mientras ese número coincida con el id de la van en la tabla `vans`; si no coincide, la API rechaza la asignación con un 400. La solución definitiva es que el frontend lea las vans desde la API cuando exista.
- **Pruebas en dispositivo real:** el GPS en un celular se verifica a mano siguiendo `docs/gps/pruebas-gps.md`.
