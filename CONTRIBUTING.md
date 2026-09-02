# Guía de contribución – CINF100

## Ramas oficiales

El proyecto utiliza dos ramas permanentes:

- `desa`
- `main`

---

## Trabajo diario

Todo el desarrollo cotidiano se realiza en:

`desa`

Los estudiantes pueden realizar commits y push directamente
a esta rama.

Cada estudiante debe utilizar su propia cuenta GitHub.

No compartir cuentas ni realizar commits utilizando
las credenciales de otro integrante.

---

## Entregas

Cuando el equipo termine un incremento o hito:

1. Verificar que `desa` esté actualizada.
2. Ejecutar pruebas.
3. Revisar documentación.
4. Confirmar Definition of Done.
5. Crear Pull Request:

`desa → main`

6. Esperar ejecución de CI.
7. Realizar Code Review.
8. Resolver observaciones.
9. Realizar merge.

---

## Prohibiciones

En `main`:

- No realizar commits directos.
- No realizar push directo.
- No hacer force push.
- No eliminar la rama.

En `desa`:

- No hacer force push.
- No eliminar la rama.
- No reescribir el historial.
- No utilizar cuentas compartidas.

Esto permite preservar las evidencias utilizadas
para evaluación y reportería.

---

## Commits

Se recomienda utilizar Conventional Commits:

feat:
fix:
docs:
test:
refactor:
chore:
ci:

Ejemplo:

feat(auth): implement login endpoint

---

## Uso de Inteligencia Artificial

GitHub Copilot y otras herramientas de IA están permitidas.

El estudiante sigue siendo responsable de:

- comprender el código generado;
- validar su funcionamiento;
- verificar seguridad;
- comprobar dependencias;
- ejecutar pruebas;
- corregir errores;
- justificar decisiones técnicas.
