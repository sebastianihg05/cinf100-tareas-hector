# RB-01 — Investigación y evaluación de React Bits

Fecha: 11-11-2026 · Responsable: Héctor Peña · Rama: `frontend-bytes`

## Objetivo

Evaluar si la biblioteca React Bits (https://reactbits.dev) sirve para dar más vida al frontend del sistema de reservas de vans UNAB, aplicándola sobre los elementos que ya existen (tarjetas, indicadores, listas, formularios), sin cambiar su funcionamiento ni la identidad institucional.

## Recomendación

Sí conviene usar React Bits, pero solo una parte pequeña del catálogo:

- Usar `AnimatedContent` y `FadeContent` para la entrada de tarjetas, listas y vistas.
- Animar los números del panel administrativo con un contador (`Counter` o `CountUp`, se decide en RB-02).
- Agregar una sola librería de animación: `gsap`.
- Descartar fondos, cursores y efectos de texto llamativos: pesan mucho y no calzan con una herramienta institucional.

## Qué es React Bits

- Es un catálogo de 218 componentes animados para React, en cinco categorías: Animations (38), Backgrounds (64), Components (48), Text Animations (33) y Micro (35).
- No se instala como paquete de npm. Cada componente es un archivo que se copia dentro del proyecto y pasa a ser código nuestro.
- Cada componente existe en cuatro variantes: JavaScript o TypeScript, con CSS plano o con Tailwind. A este proyecto le corresponde **TS-CSS**.
- Formas de agregar un componente:
  - `npx jsrepo@latest add https://reactbits.dev/r/<Componente>-TS-CSS`
  - `npx shadcn@latest add @react-bits/<Componente>-TS-CSS` (exige crear un `components.json`)
  - Copiar el archivo a mano desde la pestaña "Code" del sitio.

## Compatibilidad con el proyecto

El frontend usa React 19, TypeScript 5.6 en modo estricto, Vite 6 y CSS plano, sin librerías de animación.

Se comprobó en un proyecto de prueba aislado (fuera del repositorio) que copia el `tsconfig.json` del frontend:

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` con la configuración estricta del proyecto | 0 errores |
| `vite build` | Compila sin advertencias |
| Ejecución en el navegador | Sin errores en consola |
| Versiones usadas | react 19.3.1, vite 6.4.6, gsap 3.15.1, motion 12.43.0 |

## Dependencias y licencia

| Componente | Dependencia que exige | Líneas de código |
|---|---|---|
| AnimatedContent | `gsap` | 249 |
| FadeContent | `gsap` | 415 |
| CountUp | `motion` | 518 |
| Counter | Ninguna | 620 |
| SpotlightCard | Ninguna | 323 + 51 de CSS |
| ClickSpark, Magnet, GlareHover, StarBorder, ShinyText | Ninguna | 290 a 655 |
| SplitText | `gsap`, `@gsap/react` | 464 |
| BlurText | `motion` | 453 |
| Stepper, AnimatedList | `@hugeicons/react` | 570 a 600 |

Licencias:

- **React Bits:** MIT + Commons Clause. Permite usar los componentes dentro de una aplicación, también comercial. Prohíbe vender o redistribuir los componentes por sí solos. Exige conservar el aviso de copyright junto al código copiado.
- **gsap:** gratuita para todo uso, incluidos sus plugins.
- **motion:** MIT.

## Pruebas preliminares

Se probaron tres componentes sobre el HTML y el CSS reales del componente `Indicador` y de una tarjeta `.adm-card`:

| Componente | Aplicado a | Resultado |
|---|---|---|
| CountUp | El número de cada indicador | El número sube hasta su valor final y conserva color y tamaño |
| AnimatedContent | La cuadrícula de indicadores | Las tarjetas entran escalonadas desde abajo |
| SpotlightCard | Una tarjeta de van | Brillo que sigue al puntero; solo se nota con mouse |

No hubo desbordamiento horizontal a 430 px de ancho, que es el ancho actual de los paneles.

## Rendimiento

Peso agregado al paquete final, medido con `vite build`:

| Parte | Tamaño | Comprimido (gzip) |
|---|---|---|
| React y React DOM (referencia, ya existe) | 223,08 kB | 69,17 kB |
| `gsap` con ScrollTrigger | 115,42 kB | 45,63 kB |
| `motion` | 64,24 kB | 22,78 kB |
| Los tres componentes probados más la página de prueba | 18,80 kB | 8,05 kB |

- Usar las dos librerías suma 68,41 kB comprimidos, casi lo mismo que React completo. Por eso se recomienda quedarse con una sola.
- `gsap` cubre la mayor parte de los componentes útiles (AnimatedContent, FadeContent). `motion` solo haría falta para CountUp.
- Los 64 fondos usan WebGL o canvas de forma continua. Se descartan por consumo de batería en los teléfonos de los conductores.

## Accesibilidad y móvil

- AnimatedContent, CountUp y SpotlightCard revisan `prefers-reduced-motion`: si el usuario pidió menos movimiento en su sistema, muestran el estado final sin animar. Se verificó en el código fuente.
- CountUp deja el número final como texto normal en la página, legible por lectores de pantalla.
- Los efectos que dependen del puntero (SpotlightCard, Magnet, GlareHover) no aportan en pantallas táctiles. Si se usan, deben limitarse a escritorio.

## Dónde aplicarlos

| Panel | Pantalla | Elemento existente | Componente |
|---|---|---|---|
| Administrador | `/admin/panel` | Números de `Indicador` | Counter o CountUp |
| Administrador | `/admin/panel` | Cuadrícula de indicadores y gráficos | AnimatedContent escalonado |
| Administrador | `/admin/vans`, `/admin/choferes`, `/admin/pasajeros`, `/admin/viajes` | Listas de tarjetas `.adm-card` | AnimatedContent escalonado |
| Funcionario | `/pasajero/reservar`, `/pasajero/asiento/*` | Cambio entre pasos de la reserva | FadeContent |
| Funcionario | `/pasajero/confirmacion`, `/pasajero/reservas` | Resumen y tarjetas de reservas | AnimatedContent |
| Conductor | `/conductor/viajes`, `/conductor/historial` | Lista de viajes | AnimatedContent escalonado |
| Conductor | `/conductor/viajes/:viajeId` | Detalle del viaje y pasajeros | FadeContent |

Las barras de los gráficos y la selección de asientos se pueden animar con transiciones CSS, sin componentes de React Bits.

## Componentes descartados

| Componente o grupo | Motivo |
|---|---|
| Backgrounds (los 64) | Peso, consumo continuo y estilo ajeno a la identidad UNAB |
| Cursores (BlobCursor, SplashCursor, TargetCursor y similares) | No funcionan en pantallas táctiles y distraen |
| Textos con efecto (GlitchText, DecryptedText, ScrambledText, FuzzyText) | Dificultan la lectura y no son institucionales |
| SplitText, BlurText | Exigen dependencias extra para títulos cortos |
| Stepper, AnimatedList | Exigen una librería de íconos adicional |
| Galerías y menús (Carousel, Dock, GooeyNav, InfiniteMenu) | Reemplazarían la navegación actual en vez de mejorarla |

## Limitaciones y dificultades de integración

- **Mantención:** cada componente son entre 250 y 650 líneas que quedan en el repositorio. Conviene copiar pocos y guardarlos en una sola carpeta.
- **Pruebas automáticas:** el entorno de pruebas (jsdom) no tiene `IntersectionObserver`, que CountUp y SpotlightCard usan para detectar si están en pantalla. Hay pruebas que leen textos del panel (`PanelPendiente.test.tsx`, `admin.test.tsx`). Este riesgo no se probó todavía y debe resolverse en RB-03.
- **Licencia:** hay que copiar el aviso de copyright de React Bits junto a los componentes.
- **Ancho del panel administrativo:** hoy está limitado a 430 px (`.adm-shell` en `frontend/src/styles/admin.css`). La tarea UI-06 lo va a cambiar, y las animaciones de RB-04 deben coordinarse con ese cambio.

## Pendiente para RB-02

- Elegir entre `Counter` (sin dependencias, aún sin probar) y `CountUp` (probado, exige `motion`, +22,78 kB).
- Confirmar la lista final de componentes y la pantalla de cada uno.
