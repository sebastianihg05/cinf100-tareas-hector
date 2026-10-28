## CINF100 – Integrador I: Práctica I

Universidad Andrés Bello – UNAB DevHub

### Identificación

- Semestre: `{{2}}`
- Sede: `{{ Viña del mar }}`
- Sección: `{{ 8535 }}`
- Grupo: `{{ 2 }}`

---

## Levantar la aplicación

Requisitos: Docker Desktop abierto y Node.js 22. Desde la raíz del repositorio:

```bash
npm install
npm run dev
```

`npm install` instala el backend y el frontend. `npm run dev` crea los `.env` que falten,
levanta PostgreSQL con Docker (migraciones y usuarios de prueba) y arranca la API y la app:

| Qué | Dirección |
|---|---|
| App | `http://localhost:5173` |
| API | `http://localhost:3000` |
| Adminer (ver la base) | `http://localhost:8080` |

Al arrancar muestra la contraseña de las cuentas de prueba (`dev.admin@unab.cl` y las demás de
[`database/README.md`](database/README.md)). Es `SEED_PASSWORD` de tu `.env`, que no se sube a GitHub.
Ctrl + C detiene la API y la app; la base sigue en Docker hasta `docker compose stop`.

- Base de datos: [`database/README.md`](database/README.md).
- Backend (Node.js + Express + TypeScript): [`backend/README.md`](backend/README.md).
- Rutas de la API y cómo las usa el frontend: [`docs/api/`](docs/api/).

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