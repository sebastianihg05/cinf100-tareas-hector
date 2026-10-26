# BD-07 — Persistencia de usuarios

## 1. Objetivo

Comprobar que los usuarios se guardan, se pueden consultar, sobreviven al reinicio de los servicios y que la base rechaza duplicados.

## 2. Dónde se guardan los datos

Los datos viven en el volumen de Docker `postgres_data`, montado en `/var/lib/postgresql/data`. El volumen es independiente del contenedor: detener o eliminar el contenedor no borra los datos. Solo `docker compose down -v` elimina el volumen.

## 3. Procedimiento

```bash
# 1. Levantar y cargar el seed
docker compose up -d

# 2. Insertar un usuario
docker compose exec database psql -U devhub -d cinf100 -c "INSERT INTO usuarios (nombre_completo, correo, hash_contrasena, telefono, sede) VALUES ('Persistencia', 'persiste@unab.cl', '\$2a\$10\$x', '+56987654321', 'Quintay');"

# 3. Detener y volver a levantar (sin -v)
docker compose down
docker compose up -d

# 4. Consultar
docker compose exec database psql -U devhub -d cinf100 -c "SELECT id, correo, estado_aprobacion FROM usuarios ORDER BY id;"

# 5. Intentar un duplicado
docker compose exec database psql -U devhub -d cinf100 -c "INSERT INTO usuarios (nombre_completo, correo, hash_contrasena, telefono, sede) VALUES ('Duplicado', 'persiste@unab.cl', '\$2a\$10\$x', '+56987654321', 'Quintay');"
```

## 4. Resultados

| Prueba | Resultado esperado | Resultado obtenido |
|---|---|---|
| Consulta después de `down` y `up` | Siguen los 6 usuarios del seed y el insertado (7 filas). | 7 filas; `persiste@unab.cl` sigue presente. |
| Volver a ejecutar `up` | El seed no duplica filas y las migraciones no se repiten. | `ya aplicada` para 001 y 002; siguen 7 filas. |
| Duplicado con el mismo correo | Rechazado. | Rechazado por `usuarios_correo_unique_ci`. |
| Duplicado con mayúsculas (`PERSISTE@unab.cl`) | Rechazado. | Rechazado por `usuarios_correo_minusculas_check`. |
| Datos inválidos | Rechazados. | Ver `pruebas-integridad-usuarios.md` (23 casos). |

## 5. Conclusión

Los usuarios se consultan correctamente, se conservan al reiniciar los servicios y la base rechaza registros duplicados o inválidos.
