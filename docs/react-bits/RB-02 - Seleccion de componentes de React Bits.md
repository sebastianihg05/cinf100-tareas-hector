# RB-02 — Selección de componentes de React Bits

Fecha: 11-11-2026 · Responsable: Héctor Peña · Rama: `frontend-bytes`

## Objetivo

Elegir los componentes de React Bits que se van a integrar y definir en qué elemento existente de cada pantalla se aplican. El criterio es que las animaciones se noten y den vida a la aplicación, sin cambiar su funcionamiento ni los colores UNAB (azul `#003366`, rojo `#cc0033`).

## Decisión

Se seleccionan 12 componentes. Solo se agrega una librería, `gsap`. Los otros 10 componentes no exigen ninguna dependencia.

Cambio respecto a RB-01: se revisó de nuevo el catálogo y varios componentes llamativos resultaron no necesitar librerías extra. Por eso la selección es más amplia que la recomendada en RB-01. El contador elegido es `Counter` (sin dependencias), con lo que `motion` queda descartada.

## Componentes seleccionados

| # | Componente | Qué hace | Dependencia | Líneas |
|---|---|---|---|---|
| 1 | AnimatedContent | Las tarjetas entran escalonadas, una tras otra | `gsap` | 249 |
| 2 | FadeContent | La vista aparece con desenfoque al cambiar de pantalla o de estado | `gsap` | 415 |
| 3 | TextType | Escribe un texto letra por letra | `gsap` | 436 |
| 4 | Counter | Los dígitos ruedan hasta el valor, como un marcador | Ninguna | 620 |
| 5 | SloshGauge | Medidor con líquido que se mueve; muestra un porcentaje | Ninguna | 364 |
| 6 | HoldButton | Botón que se llena mientras se mantiene presionado | Ninguna | 319 |
| 7 | StarBorder | Luz que recorre el borde de un botón | Ninguna | 654 |
| 8 | ClickSpark | Chispas en el punto donde se hace clic | Ninguna | 493 |
| 9 | ShinyText | Brillo que cruza un texto | Ninguna | 410 |
| 10 | GlareHover | Reflejo que barre una tarjeta al pasar el mouse | Ninguna | 334 |
| 11 | LatticeLoader | Indicador de carga con una cuadrícula animada y texto | Ninguna | 215 |
| 12 | Waves | Fondo de líneas onduladas | Ninguna | 783 |

## Dónde se aplica cada uno

### Panel administrador

| Pantalla | Elemento existente | Componente | Configuración |
|---|---|---|---|
| Todas | Encabezado azul `.adm-header` | Waves | Fondo azul, líneas blancas al 28 %, acento rojo |
| Todas | Saludo "Hola, Administrador" | TextType | Una sola vez, sin cursor |
| `/admin/panel` | Número de cada `Indicador` | Counter | Mismo tamaño y color que hoy |
| `/admin/panel` | Cuadrícula de indicadores y gráficos | AnimatedContent | Entrada desde abajo, 0,09 s entre tarjetas |
| `/admin/panel` | Barras de ocupación de próximos viajes | SloshGauge | Líquido azul, porcentaje de asientos ocupados |
| `/admin/vans`, `/admin/choferes`, `/admin/pasajeros`, `/admin/viajes` | Listas de tarjetas `.adm-card` | AnimatedContent + GlareHover | GlareHover solo en escritorio |
| Todas las que cargan datos | Mensajes de carga | LatticeLoader | Azul, con texto "Cargando…" |

### Panel funcionario

| Pantalla | Elemento existente | Componente | Configuración |
|---|---|---|---|
| `/pasajero/reservar` | Botón "Seleccionar asientos" | StarBorder | Fondo azul, luz roja y blanca |
| `/pasajero/reservar`, `/pasajero/asiento/*` | Cambio entre pasos | FadeContent | Con desenfoque, 0,5 s |
| `/pasajero/asiento/*` | Botón de confirmar reserva | ClickSpark | Chispas rojas y azules |
| `/pasajero/confirmacion` | Título "¡Reserva Confirmada!" | ShinyText | Texto azul, brillo celeste |
| `/pasajero/confirmacion`, `/pasajero/reservas` | Tarjetas de detalle y de reservas | AnimatedContent | Entrada escalonada |

### Panel conductor

| Pantalla | Elemento existente | Componente | Configuración |
|---|---|---|---|
| `/conductor/viajes`, `/conductor/historial` | Lista de viajes | AnimatedContent | Entrada escalonada |
| `/conductor/viajes/:viajeId` | Botones "Iniciar viaje" y "Finalizar viaje" | HoldButton | Azul que se llena de rojo en 0,9 s |
| `/conductor/viajes/:viajeId` | Tarjeta de resumen al cambiar de estado | FadeContent | Con desenfoque |
| `/conductor/viajes/:viajeId` | "Asientos reservados" | SloshGauge | Líquido azul |

HoldButton reemplazaría el diálogo de confirmación actual de iniciar y finalizar viaje: mantener presionado cumple la misma función de evitar toques accidentales. Este cambio de comportamiento debe validarse con el equipo antes de RB-05.

## Verificación de la selección

Los 12 componentes se montaron juntos en el proyecto de prueba aislado, con los estilos reales de `admin.css`, `pasajero.css` e `Indicador.css`:

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` con la configuración estricta del proyecto | 0 errores |
| `vite build` | Compila sin advertencias |
| Navegador en escritorio (1024 px) | Sin errores en consola |
| Navegador en móvil (375 px) | Sin errores ni desbordamiento horizontal |
| Altura de los botones en móvil | 44 px o más (HoldButton 44, StarBorder 48) |
| `prefers-reduced-motion` | Los 12 lo revisan en su código o en su CSS |

No se probó todavía: mantener presionado HoldButton hasta completar, las chispas de ClickSpark al hacer clic y el comportamiento con "menos movimiento" activado. Quedan para RB-06.

## Peso

| Parte | Tamaño | Comprimido (gzip) |
|---|---|---|
| Los 12 componentes | 88,31 kB | 32,94 kB |
| `gsap` con ScrollTrigger | 115,42 kB | 45,63 kB |
| **Total agregado** | **203,73 kB** | **78,57 kB** |
| React y React DOM (referencia) | 223,08 kB | 69,17 kB |

El total supera el peso de React. Es el costo de que las animaciones destaquen. En RB-06 se medirá en el proyecto real y, si hace falta, se cargarán los componentes más pesados (Waves, StarBorder, Counter) solo en las pantallas que los usan.

## Detalles de integración detectados

- **ClickSpark** ocupa el 100 % del alto de su contenedor por defecto. Hay que pasarle `style={{ height: 'auto' }}`.
- **Waves** usa canvas de forma continua. Se limita al encabezado, que es un área pequeña, y tiene la opción `paused` para detenerlo.
- **GlareHover** depende del mouse. En pantallas táctiles no se activa, así que no molesta, pero tampoco aporta.
- **Counter** recibe `textColor="currentColor"` para heredar el color de cada indicador.
- Son 5.292 líneas de código copiado en total. Se guardarán en una sola carpeta, con el aviso de licencia de React Bits.

## Descartados en esta revisión

| Componente | Motivo |
|---|---|
| CountUp, JellyRadio, RubberSegment, TearTicket, StatusMark, SquishSwitch | Exigen `motion`, una segunda librería |
| Stepper, AnimatedList, BellToggle, SwipeToast, MagicBento | Exigen la librería de íconos `@hugeicons` |
| SplitText | Exige `@gsap/react` además de `gsap` |
| PillNav, Dock | Reemplazarían la barra de navegación inferior actual |
| SoftAurora, DotGrid, Threads, Topography | Fondos WebGL; Waves cubre la misma necesidad con menos costo |
| SpotlightCard, TiltedCard, Magnet | Mismo uso que GlareHover; se deja uno solo |

## Siguiente paso (RB-03)

Instalar `gsap`, copiar los 12 componentes a una carpeta compartida del frontend y dejarlos configurados con los colores UNAB para reutilizarlos en RB-04 y RB-05.
