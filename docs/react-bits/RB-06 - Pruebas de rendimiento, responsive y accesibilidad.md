# RB-06 — Pruebas de rendimiento, responsive y accesibilidad de React Bits

Fecha: 11-11-2026 · Responsable: Héctor Peña · Rama: `frontend-bytes`

## Objetivo

Comprobar que las animaciones agregadas en RB-03, RB-04 y RB-05 funcionan, no rompen la aplicación en celular ni en escritorio, respetan la accesibilidad y tienen un costo de rendimiento conocido.

## Resumen

| Aspecto | Resultado |
|---|---|
| Pruebas automáticas del frontend | 175 de 175 pasan |
| Compilación (`tsc` + `vite build`) | Sin errores |
| Errores en consola del navegador | Ninguno en las 11 pantallas revisadas |
| Desborde horizontal en celular (375 px) | Había 1, en Reservar; corregido |
| Botones nuevos en celular | 44 px o más de alto |
| Menos movimiento (`prefers-reduced-motion`) | Los 12 componentes y las 2 animaciones CSS propias lo respetan |
| Peso agregado al paquete | +79,29 kB comprimidos (ver detalle) |

## Cambios hechos en esta tarea

| Cambio | Archivo | Motivo |
|---|---|---|
| "Iniciar viaje" y "Finalizar viaje" ahora son HoldButton | `conductor/pages/ViajeDetalle.tsx` | Mantener presionado 0,9 s cambia el estado del viaje. Un toque corto o el teclado siguen abriendo el diálogo de confirmación, así que no se pierde el comportamiento anterior. |
| Ayuda del HoldButton en español y fuera del nombre del botón | `reactbits/HoldButton.tsx` | El texto original estaba en inglés y se sumaba al nombre que leen los lectores de pantalla ("Iniciar viaje Press and hold…"). Ahora se lee como descripción. |
| Recorte del brillo de StarBorder | `styles/pasajero.css` | Su lienzo se dibuja 32 px fuera del botón y ensanchaba la pantalla Reservar a 407 px en un celular de 375 px. |
| Entrada de tarjetas más notoria | `reactbits/unab.ts` | Con 24 px de recorrido casi no se notaba. Ahora suben 40 px, crecen desde 96 % y duran 0,7 s. |

## Responsive

Se recorrieron las pantallas con sesión de cada rol y los datos de ejemplo, en escritorio (1024 px) y celular (375 px):

| Rol | Pantallas | Escritorio | Celular |
|---|---|---|---|
| Administrador | Panel, Vans, Choferes, Pasajeros, Viajes | Sin desborde | Sin desborde |
| Funcionario | Reservar, Mis reservas, Perfil | Sin desborde | Reservar desbordaba 32 px; corregido |
| Conductor | Mis viajes, Historial, Detalle del viaje | Sin desborde | Sin desborde |

Hallazgo previo, no causado por las animaciones: en celular, los botones "Editar" y "Dar de baja" de Vans, "Ver pasajeros" y "Cancelar viaje" de Viajes y el enlace del celular del pasajero miden menos de 24 px de alto. Se deja registrado para las tareas de corrección visual (UI-03 y UI-04).

## Accesibilidad

- **Menos movimiento:**
  - Los 12 componentes revisan `prefers-reduced-motion` en su código o en su CSS. Cuando el sistema lo pide, muestran el estado final sin animar.
  - Las animaciones CSS propias (barras que crecen y fundido entre vistas) tienen su regla `@media (prefers-reduced-motion: reduce)`.
- **Lectores de pantalla:**
  - Counter y TextType dejan el texto final en un elemento oculto visualmente, así que el número o el saludo se leen completos.
  - Waves y el fondo de los encabezados están marcados `aria-hidden`.
- **Teclado:**
  - HoldButton responde a Enter y Espacio: mantenerlos presionados completa la acción y pulsarlos abre la confirmación.
  - El resto de los botones no cambió de elemento HTML.
- **Pruebas:** las pruebas existentes que buscan botones por su nombre ("Iniciar viaje", "Seleccionar asientos", "Confirmar Asiento Ida") siguen pasando, lo que confirma que los nombres accesibles no cambiaron.

## Rendimiento

Peso del archivo JavaScript principal, medido con `vite build`:

| Versión | Tamaño | Comprimido (gzip) |
|---|---|---|
| `desa` antes de React Bits | 384,81 kB | 116,65 kB |
| `frontend-bytes` con RB-06 | 580,84 kB | 195,94 kB |
| **Diferencia** | **+196,03 kB** | **+79,29 kB** |

- `gsap` aporta unos 45 kB comprimidos. El resto son los componentes, sobre todo Counter, StarBorder y Waves.
- Waves dibuja continuamente en un lienzo. Solo ocupa el encabezado (unos 430 × 84 px) y se detiene cuando la pestaña no está visible.
- La página `/demo-animaciones` se carga aparte y solo en desarrollo, así que no pesa en producción.

**Recomendación:** separar el código por rol (cargar el panel de administrador, funcionario o conductor solo cuando se entra a él) reduciría lo que descarga la pantalla de login. No se hizo aquí porque cambia cómo se cargan todas las rutas y afectaría muchas pruebas existentes; queda como mejora futura.

## Lo que no se pudo comprobar

- **Las animaciones en movimiento:** el navegador de revisión tenía la ventana oculta, y en ese estado el navegador pausa las animaciones. Se revisó la estructura, los tamaños y la consola; la fluidez debe verificarse a mano.
- **Celulares reales:** no se probó en un teléfono físico.
- **El modo "menos movimiento" activado:** se verificó en el código de cada componente, no activándolo en el sistema.

## Cómo probarlo a mano

1. Levantar el proyecto con `npm run dev` desde la raíz y entrar con las cuentas de prueba.
2. Activar el modo celular del navegador (F12, luego el ícono de dispositivo) en 375 px y recorrer las pantallas de la tabla de Responsive.
3. En Windows, desactivar "Efectos de animación" (Configuración → Accesibilidad → Efectos visuales) y comprobar que las animaciones desaparecen.
4. Como conductor, abrir un viaje pendiente:
   - mantener presionado "Iniciar viaje": el botón se llena de rojo y el viaje pasa a "En curso";
   - un toque corto debe abrir la confirmación.
