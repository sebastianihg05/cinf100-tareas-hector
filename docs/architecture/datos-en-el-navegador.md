# Datos en el navegador (#2905 — Eliminar el uso de localStorage)

La aplicación **no guarda datos en `localStorage`**. Vans, conductores, cuentas, viajes, reservas y avisos se leen y se
escriben en PostgreSQL a través de la API, así que se conservan al recargar y se ven igual desde otro computador o
desde otra sesión.

## Qué queda en el navegador

| Dónde | Qué | Por qué |
|---|---|---|
| `sessionStorage` (`unab-sesion`) | Token de la sesión, rol, nombre y correo. | Lo necesita la autenticación para enviar el token en cada llamada. Se borra al cerrar la pestaña o la sesión. |
| Memoria de la página | Copia de trabajo de los datos que devolvió la API (`AdminContext`). | Las pantallas la leen mientras la página está abierta. Se borra al recargar, al iniciar sesión y al cerrar sesión. |

## Cómo se cargan los datos

| Panel | Al entrar se pide | Además |
|---|---|---|
| Administrador | `GET /api/admin/usuarios`, `/conductores`, `/vans`, `/viajes`, `/api/usuarios/me` y `/api/avisos/leidos`. | Los viajes se vuelven a pedir cada 15 s. Vans también se pide al abrir esa pantalla. |
| Funcionario | `GET /api/viajes/disponibles`, `/api/reservas`, `/api/usuarios/me` y `/api/avisos/leidos`. | Ver `docs/api/reservas.md`. |
| Conductor | `GET /api/conductor/perfil` (ficha y van), `/api/conductor/viajes`, `/api/usuarios/me` y `/api/avisos/leidos`. | La ficha y la van se cargan antes que los viajes. |

Los avisos que cada persona marca como leídos se guardan en la tabla `avisos_leidos` (`docs/api/avisos.md`).
El administrador recibe un aviso por cada viaje en curso; el conductor, los de sus viajes y reservas.

## Qué se cambió

- `adminStore.ts`: se quitaron la lectura y escritura en `localStorage`, la limpieza de viajes antiguos guardados y la
  sincronización entre pestañas. Con sesión del servidor el estado parte vacío; los datos de ejemplo solo se usan sin
  servidor (pruebas y demostración).
- `AdminContext.tsx`: `reiniciarDatos` borra la memoria al iniciar y al cerrar sesión, para que no queden datos de
  la cuenta anterior. Las vans y los avisos leídos se piden a la API.
- Las vans se cargan al entrar al panel del administrador. Antes se pedían una sola vez al abrir la página, así que
  después de iniciar sesión la pantalla Vans mostraba "Debes iniciar sesión." hasta recargar.
- **Conductor:** antes encontraba su van en una copia que el administrador había dejado en el mismo navegador
  (la lista de vans es solo para administradores). En otro computador no veía su van ni sus viajes. Ahora usa
  `GET /api/conductor/perfil`.
- **Choferes:** con el servidor, "Agregar conductor" se reemplaza por una nota. Un conductor nuevo es una cuenta que
  se registra y se aprueba con el rol Conductor en Pasajeros; antes se agregaba solo en el navegador y se perdía al
  recargar.

## Pruebas

- `frontend/src/sin-localstorage.test.tsx` comprueba cinco casos:
  - Usar los tres paneles no deja nada en `localStorage`.
  - Las vans aparecen justo después de iniciar sesión.
  - El conductor ve su van en un navegador sin datos del administrador.
  - Los avisos leídos quedan en la base.
- Las pruebas que antes ponían datos en `localStorage` ahora usan `usarEstadoDePrueba` (solo para pruebas) o el backend
  falso de `src/test/apiFalsa.ts`, que tiene vans y la ficha del conductor.
- `backend/tests/viajes.test.ts` prueba `GET /api/conductor/perfil`.
