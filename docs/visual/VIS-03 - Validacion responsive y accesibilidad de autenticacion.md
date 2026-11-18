# VIS-03 — Validación responsive y accesibilidad de autenticación (#2326)

Revisión del rediseño de VIS-01 y VIS-02 en las cuatro pantallas de acceso: **Iniciar sesión** (`/login`),
**Crear cuenta** (`/registro`), **Recuperar contraseña** (`/recuperar`) y **Registro enviado** (`/registro/exito`).
Lo que no cumplía se corrigió en la misma tarea.

## Cómo se revisó

- Navegador Chromium con el viewport en 320, 768 y 1440 px de ancho. En cada ancho se midió con JavaScript si algún
  elemento se sale de la pantalla (`scrollWidth` contra `clientWidth`) y el tamaño de cada botón y campo.
- 320 px equivale a un celular chico y también a ver la página con 400 % de zoom en un computador de 1280 px (WCAG 1.4.10).
- Contraste calculado con la fórmula de WCAG 2.1 para cada par de colores de `login/styles/auth.css`.
- Recorrido con la tecla Tab y revisión del foco visible.
- Pruebas automáticas en `frontend/src/login/accesibilidad.test.tsx` (8 pruebas) y las 20 que ya existían en `login.test.tsx`.

## Resultados

### Responsive

| Ancho | Login | Registro | Recuperar | Registro enviado |
|---|---|---|---|---|
| 320 px | ✅ sin desborde | ✅ sin desborde | ✅ sin desborde | ✅ sin desborde |
| 768 px | ✅ | ✅ | ✅ | ✅ |
| 1440 px | ✅ columna centrada de 440 px | ✅ | ✅ | ✅ |

### Contraste (mínimo AA: 4,5:1 para texto y 3:1 para bordes y foco)

| Par de colores | Contraste |
|---|---|
| Texto secundario `#b7c5dd` sobre el fondo `#03102c` | 10,81:1 ✅ |
| Enlaces `#ff9ab0` sobre el fondo | 9,42:1 ✅ |
| Botón "Ver" `#ff9ab0` sobre el campo `#142543` | 7,63:1 ✅ |
| Placeholder `#aab9d0` sobre el campo | 7,68:1 ✅ |
| Texto blanco sobre el campo | 15,27:1 ✅ |
| Texto blanco sobre el botón rojo `#a90429` (y `#c01941` al pasar el mouse) | 7,67:1 y 6,08:1 ✅ |
| Borde del campo `#667993` contra el fondo y contra el relleno | 4,24:1 y 3,43:1 ✅ |
| Anillo de foco `#ff93a6` contra el fondo | 8,95:1 ✅ |
| Mensaje de error y mensaje de éxito sobre su caja | 12,14:1 y 11,73:1 ✅ |

La paleta de VIS-01 cumple AA en todos los casos; no hubo que cambiar colores.

### Teclado

El orden con Tab es el de la pantalla (correo → contraseña → Ver → ¿Olvidaste tu contraseña? → Ingresar → Regístrate)
y todo control enfocado muestra un borde o anillo visible. ✅

## Problemas encontrados y corrección

| # | Problema | Corrección |
|---|---|---|
| 1 | Los mensajes de error no se anunciaban con lector de pantalla. | `role="alert"` en los errores y `role="status"` en el mensaje de éxito de Recuperar. |
| 2 | El botón "Ver" se leía solo como "Ver" (no decía de qué campo) y medía 30 × 28 px. | Componente `CampoContrasena`: dice "Ver contraseña" / "Ocultar confirmar contraseña", indica el campo con `aria-controls` y mide 44 × 44 px. |
| 3 | Los campos tenían letra de 15 px: Safari de iPhone hace zoom al tocarlos. | Letra de 16 px. |
| 4 | "¿Olvidaste tu contraseña?" medía 21 px de alto y "Volver a iniciar sesión" 35 px. | 44 px de alto, conservando el mismo espacio entre elementos. |
| 5 | Los campos no tenían `autocomplete`: el navegador y el gestor de contraseñas no sabían qué dato iba en cada uno. | `username`, `current-password`, `name`, `email`, `tel` y `new-password` según el campo. |
| 6 | En el registro, las reglas (correo institucional, formato del celular, mínimo 8 caracteres) solo estaban en el placeholder, que desaparece al escribir. | Texto de ayuda visible bajo cada campo, unido con `aria-describedby`; los campos obligatorios llevan `aria-required`. |
| 7 | Recuperar contraseña y Registro enviado seguían con el ícono antiguo, sin el logo institucional del rediseño. | Componente `MarcaAuth`, el mismo encabezado en las cuatro pantallas. |
| 8 | En modo de alto contraste de Windows el foco de los campos no se veía (usaban `outline: none`). | Borde de foco transparente que ese modo sí dibuja. |
| 9 | Recuperar contraseña tenía su propia validación del correo institucional. | Usa `esCorreoInstitucional`, la misma del login y el registro. |
| 10 | Mientras se enviaba, el botón no mostraba que estaba trabajando. | Dice "Ingresando…" o "Creando cuenta…". |

Las validaciones de los formularios no cambiaron: siguen pasando las 20 pruebas de `login.test.tsx`.

## Pendiente fuera de esta tarea

Los enlaces "Regístrate" e "Inicia sesión" van dentro de una frase y miden menos de 44 px de alto.
WCAG 2.5.8 permite esa excepción para enlaces dentro de un texto, así que se dejaron igual.
