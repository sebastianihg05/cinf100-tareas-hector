-- S3-BD-01 (#2596): pruebas automáticas de la tabla vans.
-- Todo corre dentro de una transacción que se revierte: no deja datos.
--
-- Ejecutar (con los contenedores levantados):
--   docker compose exec database psql -U devhub -d cinf100 -f /database/tests/vans_restricciones.sql

\set ON_ERROR_STOP on
\set QUIET on
\pset pager off
SET client_min_messages = notice;
BEGIN;

CREATE TEMP TABLE resultados (n SERIAL, caso TEXT, ok BOOLEAN, detalle TEXT);

-- Ejecuta una sentencia que DEBE fallar por la restricción indicada.
CREATE FUNCTION pg_temp.debe_fallar(caso TEXT, sentencia TEXT, restriccion TEXT)
RETURNS VOID AS $$
DECLARE obtenida TEXT;
BEGIN
    BEGIN
        EXECUTE sentencia;
        INSERT INTO resultados (caso, ok, detalle) VALUES (caso, FALSE, 'se aceptó');
        RAISE EXCEPTION 'deshacer';
    EXCEPTION
        WHEN raise_exception THEN NULL;
        WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS obtenida = CONSTRAINT_NAME;
            INSERT INTO resultados (caso, ok, detalle)
            VALUES (caso, COALESCE(obtenida, SQLERRM) = restriccion
                          OR SQLERRM LIKE '%' || restriccion || '%',
                    COALESCE(NULLIF(obtenida, ''), SQLERRM));
    END;
END;
$$ LANGUAGE plpgsql;

-- Ejecuta una sentencia que DEBE funcionar (y la deshace).
CREATE FUNCTION pg_temp.debe_funcionar(caso TEXT, sentencia TEXT)
RETURNS VOID AS $$
BEGIN
    BEGIN
        EXECUTE sentencia;
        RAISE EXCEPTION 'deshacer';
    EXCEPTION
        WHEN raise_exception THEN
            INSERT INTO resultados (caso, ok, detalle) VALUES (caso, TRUE, 'aceptado');
        WHEN OTHERS THEN
            INSERT INTO resultados (caso, ok, detalle) VALUES (caso, FALSE, SQLERRM);
    END;
END;
$$ LANGUAGE plpgsql;

-- Oculta la salida de cada caso; el resumen va al final.
\o /dev/null

-- Datos base: Ana (conductora activa) maneja la van ZZ-9001; Bruno es conductor activo sin van;
-- Daniela está dada de baja.
INSERT INTO usuarios (nombre_completo, correo, hash_contrasena, telefono, sede)
VALUES ('Ana Conductora', 'ana.van.test@unab.cl', '$2a$10$x', '+56944444441', 'Quintay')
RETURNING id AS ana \gset
INSERT INTO usuarios (nombre_completo, correo, hash_contrasena, telefono, sede)
VALUES ('Bruno Conductor', 'bruno.van.test@unab.cl', '$2a$10$x', '+56944444442', 'Quintay')
RETURNING id AS bruno \gset
INSERT INTO usuarios (nombre_completo, correo, hash_contrasena, telefono, sede)
VALUES ('Daniela Baja', 'daniela.van.test@unab.cl', '$2a$10$x', '+56944444443', 'Quintay')
RETURNING id AS daniela \gset
INSERT INTO conductores (usuario_id) VALUES (:ana), (:bruno);
INSERT INTO conductores (usuario_id, activo) VALUES (:daniela, FALSE);

INSERT INTO vans (patente, conductor_id) VALUES ('ZZ-9001', :ana)
RETURNING id AS van \gset

-- Datos válidos.
SELECT pg_temp.debe_funcionar('van sin conductor: capacidad 9 y activa por defecto', $sql$
DO $$
DECLARE v vans;
BEGIN
    INSERT INTO vans (patente) VALUES ('ZZ-9002') RETURNING * INTO v;
    IF v.capacidad <> 9 OR NOT v.activa OR v.conductor_id IS NOT NULL THEN
        RAISE EXCEPTION 'valores por defecto inesperados';
    END IF;
END $$;
$sql$);
SELECT pg_temp.debe_funcionar('patente de formato antiguo (4 letras y 2 números)',
    'INSERT INTO vans (patente) VALUES (''ZZZZ-12'')');
SELECT pg_temp.debe_funcionar('asignar un conductor activo sin van',
    format('INSERT INTO vans (patente, conductor_id) VALUES (''ZZ-9003'', %s)', :bruno));

-- Patente.
SELECT pg_temp.debe_fallar('patente sin guion',
    'INSERT INTO vans (patente) VALUES (''ZZ9004'')', 'vans_patente_formato_check');
SELECT pg_temp.debe_fallar('patente en minúsculas',
    'INSERT INTO vans (patente) VALUES (''zz-9004'')', 'vans_patente_formato_check');
SELECT pg_temp.debe_fallar('patente vacía',
    'INSERT INTO vans (patente) VALUES (NULL)', 'patente');
SELECT pg_temp.debe_fallar('patente repetida',
    'INSERT INTO vans (patente) VALUES (''ZZ-9001'')', 'vans_patente_unique');

-- Capacidad.
SELECT pg_temp.debe_fallar('capacidad mayor que los 9 asientos de la Staria',
    'INSERT INTO vans (patente, capacidad) VALUES (''ZZ-9005'', 10)', 'vans_capacidad_check');
SELECT pg_temp.debe_fallar('capacidad cero',
    'INSERT INTO vans (patente, capacidad) VALUES (''ZZ-9005'', 0)', 'vans_capacidad_check');

-- Conductor asignado.
SELECT pg_temp.debe_fallar('conductor inexistente',
    'INSERT INTO vans (patente, conductor_id) VALUES (''ZZ-9006'', -1)', 'vans_conductor_id_fkey');
SELECT pg_temp.debe_fallar('el mismo conductor en dos vans',
    format('INSERT INTO vans (patente, conductor_id) VALUES (''ZZ-9006'', %s)', :ana), 'vans_conductor_unique');
SELECT pg_temp.debe_fallar('conductor dado de baja',
    format('INSERT INTO vans (patente, conductor_id) VALUES (''ZZ-9006'', %s)', :daniela), 'vans_conductor_activo_check');
SELECT pg_temp.debe_fallar('van dada de baja con conductor',
    format('UPDATE vans SET activa = FALSE WHERE id = %s', :van), 'vans_baja_sin_conductor_check');
SELECT pg_temp.debe_funcionar('dar de baja la van quitándole el conductor',
    format('UPDATE vans SET activa = FALSE, conductor_id = NULL WHERE id = %s', :van));
SELECT pg_temp.debe_funcionar('al dar de baja al conductor, su van queda libre', format($sql$
DO $$
BEGIN
    UPDATE conductores SET activo = FALSE WHERE usuario_id = %s;
    IF (SELECT conductor_id FROM vans WHERE id = %s) IS NOT NULL THEN
        RAISE EXCEPTION 'la van sigue con el conductor dado de baja';
    END IF;
END $$;
$sql$, :ana, :van));
SELECT pg_temp.debe_funcionar('al borrar la cuenta del conductor, la van se conserva sin conductor', format($sql$
DO $$
BEGIN
    DELETE FROM usuarios WHERE id = %s;
    IF (SELECT conductor_id FROM vans WHERE id = %s) IS NOT NULL THEN
        RAISE EXCEPTION 'la van sigue apuntando al conductor borrado';
    END IF;
END $$;
$sql$, :ana, :van));

-- Relación con viajes.
\set ins_viaje 'INSERT INTO viajes (fecha, hora, trayecto, origen, destino, van_id) VALUES (CURRENT_DATE + 410, ''06:45'', ''Ida'', ''Quillota 980'', ''Santiago'', '
SELECT pg_temp.debe_funcionar('viaje con una van existente', :'ins_viaje' || :van || ')');
SELECT pg_temp.debe_fallar('viaje con una van inexistente', :'ins_viaje' || '-1)', 'viajes_van_id_fkey');
SELECT pg_temp.debe_fallar('no se borra una van que tiene viajes', format($sql$
    %s%s);
    DELETE FROM vans WHERE id = %s
$sql$, :'ins_viaje', :van, :van), 'viajes_van_id_fkey');

-- Trigger.
SELECT pg_temp.debe_funcionar('actualizado_en cambia al editar la van', format($sql$
DO $$
DECLARE antes TIMESTAMPTZ; despues TIMESTAMPTZ;
BEGIN
    SELECT actualizado_en INTO antes FROM vans WHERE id = %s;
    PERFORM pg_sleep(0.01);
    UPDATE vans SET capacidad = 8 WHERE id = %s;
    SELECT actualizado_en INTO despues FROM vans WHERE id = %s;
    IF despues <= antes THEN
        RAISE EXCEPTION 'actualizado_en no cambió';
    END IF;
END $$;
$sql$, :van, :van, :van));
-- Resultado.
\o
SELECT n, CASE WHEN ok THEN 'OK   ' ELSE 'FALLA' END AS resultado, caso, detalle
  FROM resultados ORDER BY n;

DO $$
DECLARE total INT; fallas INT;
BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE NOT ok) INTO total, fallas FROM resultados;
    IF fallas > 0 THEN
        RAISE EXCEPTION '% de % pruebas fallaron', fallas, total;
    END IF;
    RAISE NOTICE 'Todas las pruebas pasaron (% de %)', total, total;
END $$;

ROLLBACK;
