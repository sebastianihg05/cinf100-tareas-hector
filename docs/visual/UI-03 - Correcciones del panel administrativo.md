# UI-03 — Correcciones del panel administrativo (#2332)

Corrección de los problemas del administrador que encontró la auditoría
(`UI-01 - Auditoria de margenes y alineaciones de los paneles.md`, sección "Administrador"), usando las variables de
`UI-02 - Guia de estilos compartidos.md`.

## Problemas corregidos

| # | Problema (UI-01) | Corrección | Medido después |
|---|---|---|---|
| A1 | "Editar" y "Dar de baja" de Vans y Choferes medían 24–25 px. | `.adm-chip` con alto compacto (`--alto-control-compacto`). También aplica a "Ver pasajeros", "Asignar van" y "Cancelar viaje". | 36 px |
| A2 | "Aprobar" y "Rechazar" con distinto alto y "Aprobar" sin radio (esquinas rectas). | Mismo alto, radio, relleno y letra para los dos. | 36 px los dos, radio 8 px |
| A3 | "Abrir viaje" se partía en dos líneas en el celular. | La cabecera de Viajes se acomoda: fecha y destino comparten fila y el botón baja a la siguiente sin partirse (`white-space: nowrap`). | 1 línea, 44 px |
| A4 | Los filtros de Viajes ocupaban 2 filas en el computador y 3 en el celular. | En el celular cada grupo de filtros es una fila que se desliza, igual que en Pasajeros. | 1 fila por grupo en 390 px |
| A5 | En Pasajeros los filtros se salían sin aviso y el placeholder del buscador se cortaba. | Los filtros que se deslizan se desvanecen en el borde derecho; placeholder más corto ("Nombre, correo, sede o destino"). | Placeholder completo en 390 px |
| A6 | "Abrir viaje" y Perfil centrados, con otro borde izquierdo. | Corregido en UI-02 (columna de lectura alineada a la izquierda). | Mismo borde (272 px) |
| A7 | En el Panel, "Próximos viajes" y "Últimas reservas" cortaban el texto con "…". | El texto baja de línea en vez de cortarse (`ListaResumen.css`). | 0 textos cortados en 1024 px |
| A8 | "Ocupación de los próximos viajes" ocupaba 2 líneas y desalineaba la fila. | Título "Ocupación de las vans"; "Próximos viajes" pasa al subtítulo. La región mantiene su nombre accesible. | 6 títulos en 1 línea en 1024 px |
| A9 | En las tarjetas de viaje la fecha bajaba de línea solo a veces y los botones quedaban a distinta altura. | La fecha va siempre en su propia línea; "Abierto por administrador" arriba y los botones abajo, en todas las tarjetas. | Igual en todas las tarjetas |
| A10 | El campo "Fecha del viaje" era más angosto y bajo que el buscador. | Campos de fecha y destino de 44 px con letra de 16 px (con menos, Safari de iPhone hace zoom). | 44 px |

Además, "Agregar van", "Agregar conductor", los filtros, "Ver reservas" y la flecha de detalle de Pasajeros quedaron con
el alto compacto de 36 px (antes 28–31 px).

## Archivos

| Archivo | Cambio |
|---|---|
| `frontend/src/styles/admin.css` | Botones, filtros, cabecera de Viajes, tarjetas de viaje y campos de fecha con las variables de UI-02. |
| `frontend/src/admin/pages/VistaViajes.tsx` | Filtros con `scroll` (deslizables en el celular). |
| `frontend/src/admin/pages/VistaPasajeros.tsx` | Placeholder del buscador. |
| `frontend/src/admin/pages/PanelPendiente.tsx` | Título y subtítulo de la ocupación. |
| `frontend/src/admin/components/ListaResumen.css` | El texto baja de línea en vez de cortarse. |

## Verificación

- Medido en el navegador en 390 y 1024 px con PostgreSQL y las cuentas de prueba: alto de los botones, textos cortados
  y desborde horizontal (ninguno).
- Las 255 pruebas del frontend siguen pasando y el proyecto compila.

## Fuera de esta tarea

- "Abrir viaje" y Perfil no muestran la tarjeta "Hola, Administrador": son subpantallas con botón de volver en el
  encabezado, igual que en los otros paneles. Se dejó así.
- Funcionario y conductor: UI-04.
