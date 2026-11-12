-- S3-BD-04 (#2599): comprueba los datos iniciales de desarrollo (seeds 003 y 004).
-- Revisa que estén los escenarios de prueba, que las relaciones entre vans, conductores, viajes y
-- reservas sean coherentes y que volver a cargar los seeds no duplique nada.
-- Todo corre dentro de una transacción que se revierte: no deja datos.
--
-- Requiere una base con los seeds cargados (docker compose up -d) y que la tabla viajes
-- solo tenga los viajes del seed. Ejecutar:
--   docker compose exec database psql -U devhub -d cinf100 -f /database/tests/datos_iniciales.sql

\set ON_ERROR_STOP on
\set QUIET on
\pset pager off
SET client_min_messages = notice;
BEGIN;

CREATE TEMP TABLE resultados (n SERIAL, caso TEXT, ok BOOLEAN, detalle TEXT);

-- Registra si la consulta (que devuelve un booleano) es verdadera.
CREATE FUNCTION pg_temp.verificar(caso TEXT, consulta TEXT)
RETURNS VOID AS $$
DECLARE resultado BOOLEAN;
BEGIN
    EXECUTE consulta INTO resultado;
    INSERT INTO resultados (caso, ok, detalle)
    VALUES (caso, COALESCE(resultado, FALSE), CASE WHEN resultado THEN 'cumple' ELSE 'no cumple' END);
EXCEPTION WHEN OTHERS THEN
    INSERT INTO resultados (caso, ok, detalle) VALUES (caso, FALSE, SQLERRM);
END;
$$ LANGUAGE plpgsql;

\o /dev/null

-- Escenarios de prueba presentes.
SELECT pg_temp.verificar('existen las 3 vans de prueba',
    $$SELECT COUNT(*) = 3 FROM vans WHERE patente IN ('FG-1251', 'SH-8568', 'CO-6768')$$);
SELECT pg_temp.verificar('FG-1251 la maneja el conductor de prueba',
    $$SELECT EXISTS (SELECT 1 FROM vans v JOIN usuarios u ON u.id = v.conductor_id
                     WHERE v.patente = 'FG-1251' AND u.correo = 'dev.conductor@unab.cl')$$);
SELECT pg_temp.verificar('CO-6768 está dada de baja y sin conductor',
    $$SELECT EXISTS (SELECT 1 FROM vans WHERE patente = 'CO-6768' AND NOT activa AND conductor_id IS NULL)$$);
SELECT pg_temp.verificar('hay viajes completados, cancelados y pendientes',
    $$SELECT COUNT(DISTINCT estado) = 3 FROM viajes WHERE estado IN ('completado', 'cancelado', 'pendiente')$$);
SELECT pg_temp.verificar('hay viajes próximos con van y sin van asignada',
    $$SELECT bool_or(van_id IS NOT NULL) AND bool_or(van_id IS NULL) FROM viajes
      WHERE estado = 'pendiente' AND fecha > CURRENT_DATE$$);
SELECT pg_temp.verificar('hay reservas pendientes, completadas y canceladas',
    $$SELECT COUNT(DISTINCT estado) = 3 FROM reservas$$);
SELECT pg_temp.verificar('hay una reserva de ida y vuelta (dos trayectos con el mismo grupo)',
    $$SELECT EXISTS (SELECT 1 FROM reservas GROUP BY grupo_id HAVING COUNT(*) = 2)$$);

-- Relaciones coherentes.
SELECT pg_temp.verificar('cada conductor maneja como máximo una van',
    $$SELECT NOT EXISTS (SELECT 1 FROM vans WHERE conductor_id IS NOT NULL GROUP BY conductor_id HAVING COUNT(*) > 1)$$);
SELECT pg_temp.verificar('ningún viaje próximo usa una van dada de baja',
    $$SELECT NOT EXISTS (SELECT 1 FROM viajes vi JOIN vans va ON va.id = vi.van_id
                         WHERE vi.estado = 'pendiente' AND NOT va.activa)$$);
SELECT pg_temp.verificar('los viajes con van y conductor usan el conductor de esa van',
    $$SELECT NOT EXISTS (SELECT 1 FROM viajes vi JOIN vans va ON va.id = vi.van_id
                         WHERE vi.conductor_id IS NOT NULL AND vi.conductor_id IS DISTINCT FROM va.conductor_id)$$);
SELECT pg_temp.verificar('ningún asiento supera la capacidad de la van del viaje',
    $$SELECT NOT EXISTS (SELECT 1 FROM reservas r JOIN viajes vi ON vi.id = r.viaje_id
                         JOIN vans va ON va.id = vi.van_id WHERE r.asiento > va.capacidad)$$);
SELECT pg_temp.verificar('las reservas activas son de viajes no cancelados',
    $$SELECT NOT EXISTS (SELECT 1 FROM reservas r JOIN viajes vi ON vi.id = r.viaje_id
                         WHERE r.estado <> 'cancelada' AND vi.estado = 'cancelado')$$);
SELECT pg_temp.verificar('las reservas completadas son de viajes completados',
    $$SELECT NOT EXISTS (SELECT 1 FROM reservas r JOIN viajes vi ON vi.id = r.viaje_id
                         WHERE r.estado = 'completada' AND vi.estado <> 'completado')$$);
SELECT pg_temp.verificar('las reservas son de cuentas de funcionario aprobadas',
    $$SELECT NOT EXISTS (SELECT 1 FROM reservas r JOIN usuarios u ON u.id = r.usuario_id
                         WHERE u.rol <> 'funcionario' OR u.estado_aprobacion <> 'aprobada')$$);
SELECT pg_temp.verificar('una ida y vuelta es del mismo funcionario, el mismo día y trayectos distintos',
    $$SELECT NOT EXISTS (SELECT 1 FROM reservas r JOIN viajes vi ON vi.id = r.viaje_id
                         GROUP BY r.grupo_id HAVING COUNT(*) > 1
                            AND (COUNT(DISTINCT r.usuario_id) > 1 OR COUNT(DISTINCT vi.fecha) > 1
                                 OR COUNT(DISTINCT vi.trayecto) < COUNT(*)))$$);

-- Volver a cargar los seeds no duplica datos.
CREATE TEMP TABLE antes AS
SELECT (SELECT COUNT(*) FROM vans) AS vans, (SELECT COUNT(*) FROM viajes) AS viajes,
       (SELECT COUNT(*) FROM reservas) AS reservas,
       (SELECT conductor_id FROM vans WHERE patente = 'FG-1251') AS conductor_fg;
SET client_min_messages = warning;
-- \ir: ruta relativa a este archivo, funciona en Docker (/database) y en el CI (database/).
\ir ../seeds/003_vans_dev.sql
\ir ../seeds/004_viajes_reservas_dev.sql
SET client_min_messages = notice;
SELECT pg_temp.verificar('cargar de nuevo los seeds no duplica vans, viajes ni reservas',
    $$SELECT a.vans = (SELECT COUNT(*) FROM vans) AND a.viajes = (SELECT COUNT(*) FROM viajes)
         AND a.reservas = (SELECT COUNT(*) FROM reservas)
         AND a.conductor_fg IS NOT DISTINCT FROM (SELECT conductor_id FROM vans WHERE patente = 'FG-1251')
      FROM antes a$$);

-- Resultado.
\o
SELECT n, CASE WHEN ok THEN 'OK   ' ELSE 'FALLA' END AS resultado, caso, detalle
  FROM resultados ORDER BY n;

DO $$
DECLARE total INT; fallas INT;
BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE NOT ok) INTO total, fallas FROM resultados;
    IF fallas > 0 THEN
        RAISE EXCEPTION '% de % comprobaciones fallaron', fallas, total;
    END IF;
    RAISE NOTICE 'Todas las comprobaciones pasaron (% de %)', total, total;
END $$;

ROLLBACK;
