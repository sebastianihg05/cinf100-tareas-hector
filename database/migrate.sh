#!/bin/sh
# Aplica en orden las migraciones de database/migrations que aún no se han
# aplicado y después carga los seeds de database/seeds.
# Lo ejecuta el servicio `migrate` de docker-compose.yml.
set -eu

DIR=/database

psql -q -v ON_ERROR_STOP=1 -c "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(255) PRIMARY KEY,
    aplicada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );"

for archivo in "$DIR"/migrations/*.sql; do
  version=$(basename "$archivo")
  aplicada=$(psql -tA -v ON_ERROR_STOP=1 \
    -c "SELECT 1 FROM schema_migrations WHERE version = '$version'")

  if [ "$aplicada" = "1" ]; then
    echo "  ya aplicada: $version"
  else
    echo "  aplicando:   $version"
    # -1: la migración y su registro van en una sola transacción.
    psql -q -1 -v ON_ERROR_STOP=1 -f "$archivo" \
      -c "INSERT INTO schema_migrations (version) VALUES ('$version')"
  fi
done

if [ "${CARGAR_SEED:-true}" = "true" ]; then
  for archivo in "$DIR"/seeds/*.sql; do
    [ -e "$archivo" ] || continue
    echo "  seed:        $(basename "$archivo")"
    psql -q -1 -v ON_ERROR_STOP=1 \
      -v seed_password="${SEED_PASSWORD:-}" -f "$archivo"
  done
fi

echo "Base de datos lista."
