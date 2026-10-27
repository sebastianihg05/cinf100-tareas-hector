## CINF100 – Integrador I: Práctica I

Universidad Andrés Bello – UNAB DevHub

### Identificación

- Semestre: `{{2}}`
- Sede: `{{ Viña del mar }}`
- Sección: `{{ 8535 }}`
- Grupo: `{{ 2 }}`

---

## Base de datos

PostgreSQL 16 en Docker. Para dejarla lista (crea la base, aplica las migraciones y carga usuarios de prueba):

```bash
docker compose up -d
```

Para ver y editar los datos en el navegador: `http://localhost:8080` (Adminer).
Instrucciones, pruebas y usuarios de prueba: [`database/README.md`](database/README.md).

## Backend

Node.js + Express + TypeScript en `backend/`: registro, inicio de sesión con JWT,
perfiles por rol y aprobación de cuentas. Instrucciones: [`backend/README.md`](backend/README.md).
Rutas de la API: [`docs/api/`](docs/api/).

---

## Modelo de trabajo DevHub

Plan → Code → Build/Test → Review → Deploy → Operate → Learn

El proyecto utiliza:

- OpenProject / GesPro para gestión.
- GitHub para desarrollo y evidencia técnica.
- GitHub Actions para CI/CD.
- GitHub Copilot como apoyo al desarrollo.

---

## Estrategia de ramas

El repositorio utiliza dos ramas permanentes:

### `desa`

Rama de desarrollo cotidiano.

Los estudiantes realizan aquí:

- commits;
- integración del trabajo;
- pruebas;
- correcciones;
- documentación;
- preparación de entregas.

El historial de `desa` será utilizado como evidencia de
contribución individual.

### `main`

Rama estable y entregable.

No se permite trabajo directo sobre `main`.

Los cambios llegan exclusivamente mediante:

`desa → Pull Request → main`

Cada Pull Request representa una entrega formal del equipo.

---

## Flujo de entrega

1. Planificar el trabajo en OpenProject.
2. Asignar paquetes de trabajo.
3. Desarrollar y hacer commits en `desa`.
4. Ejecutar pruebas y validaciones automáticas.
5. Completar el incremento comprometido.
6. Crear Pull Request `desa → main`.
7. Ejecutar Code Review.
8. Ejecutar checks CI/CD.
9. Resolver observaciones.
10. Hacer merge a `main`.
11. Desplegar la versión.
12. Realizar Sprint Review.

---

## Evidencias utilizadas para evaluación

### Desde OpenProject

- backlog;
- sprints;
- paquetes de trabajo;
- responsables;
- estados;
- horas;
- cumplimiento;
- progreso.

### Desde GitHub `desa`

- commits por estudiante;
- continuidad de participación;
- archivos modificados;
- contribuciones técnicas;
- documentación;
- evolución del producto.

### Desde Pull Requests `desa → main`

- calidad de la entrega;
- cumplimiento de Definition of Done;
- revisión de código;
- observaciones;
- resolución de observaciones;
- estado de CI;
- tests;
- fecha de entrega;
- documentación asociada.

### Desde `main`

- versiones entregables;
- releases;
- despliegues;
- evidencia de cumplimiento de hitos.