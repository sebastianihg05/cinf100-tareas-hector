-- S3-BD-02 (#2597): pruebas automáticas de la tabla viajes.
-- Todo corre dentro de una transacción que se revierte: no deja datos.
--
-- Ejecutar (con los contenedores levantados):
--   docker compose exec database psql -U devhub -d cinf100 -f /database/tests/viajes_restricciones.sql

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

-- Datos base: un conductor y un viaje de ida pendiente en una fecha lejana.
INSERT INTO usuarios (nombre_completo, correo, hash_contrasena, telefono, sede)
VALUES ('Carla Conductora', 'carla.viaje.test@unab.cl', '$2a$10$x', '+56933333333', 'Quintay')
RETURNING id AS carla \gset
INSERT INTO conductores (usuario_id) VALUES (:carla);
-- Desde 006_vans.sql, van_id es llave foránea: los casos usan esta van (la última creada, max(id)).
INSERT INTO vans (patente) VALUES ('ZZ-9901');

\set dia 'CURRENT_DATE + 400'
INSERT INTO viajes (fecha, hora, trayecto, origen, destino)
VALUES (CURRENT_DATE + 400, '06:45', 'Ida', 'Quillota 980', 'Santiago')
RETURNING id AS ida \gset

\set ida_ok '''06:45'', ''Ida'', ''Quillota 980'', ''Santiago'''
\set vuelta_ok '''17:00'', ''Vuelta'', ''Santiago'', ''Quillota 980'''
\set ins 'INSERT INTO viajes (fecha, hora, trayecto, origen, destino, van_id, conductor_id, estado, iniciado_en, finalizado_en, cancelado_en) VALUES '

-- Datos válidos.
SELECT pg_temp.debe_funcionar('viaje de ida válido queda pendiente',
    :'ins' || format('(CURRENT_DATE + 401, %s, NULL, NULL, ''pendiente'', NULL, NULL, NULL)', :'ida_ok'));
SELECT pg_temp.debe_funcionar('ida y vuelta el mismo día',
    :'ins' || format('(%s, %s, NULL, NULL, ''pendiente'', NULL, NULL, NULL)', :'dia', :'vuelta_ok'));
SELECT pg_temp.debe_funcionar('ciclo completo: pendiente, en curso y completado',
    format($sql$
        UPDATE viajes SET van_id = (SELECT max(id) FROM vans), conductor_id = %s WHERE id = %s;
        UPDATE viajes SET estado = 'en-curso', iniciado_en = now() WHERE id = %s;
        UPDATE viajes SET estado = 'completado', finalizado_en = now() WHERE id = %s
    $sql$, :carla, :ida, :ida, :ida));
SELECT pg_temp.debe_funcionar('cancelar un viaje pendiente',
    format('UPDATE viajes SET estado = ''cancelado'', cancelado_en = now() WHERE id = %s', :ida));

-- Trayecto, ruta y horario.
SELECT pg_temp.debe_fallar('trayecto inválido',
    :'ins' || format('(CURRENT_DATE + 401, ''06:45'', ''Regreso'', ''Quillota 980'', ''Santiago'', NULL, NULL, ''pendiente'', NULL, NULL, NULL)'),
    'viajes_ruta_check');
SELECT pg_temp.debe_fallar('ida con la ruta de la vuelta',
    :'ins' || format('(CURRENT_DATE + 401, ''06:45'', ''Ida'', ''Santiago'', ''Quillota 980'', NULL, NULL, ''pendiente'', NULL, NULL, NULL)'),
    'viajes_ruta_check');
SELECT pg_temp.debe_fallar('ida con otro horario',
    :'ins' || format('(CURRENT_DATE + 401, ''08:00'', ''Ida'', ''Quillota 980'', ''Santiago'', NULL, NULL, ''pendiente'', NULL, NULL, NULL)'),
    'viajes_ruta_check');
SELECT pg_temp.debe_fallar('destino fuera de la ruta',
    :'ins' || format('(CURRENT_DATE + 401, ''17:00'', ''Vuelta'', ''Santiago'', ''Quintay'', NULL, NULL, ''pendiente'', NULL, NULL, NULL)'),
    'viajes_ruta_check');

-- Estado y fechas de cada cambio.
SELECT pg_temp.debe_fallar('estado inválido',
    :'ins' || format('(CURRENT_DATE + 401, %s, NULL, NULL, ''abierto'', NULL, NULL, NULL)', :'ida_ok'),
    'viajes_estado_check');
SELECT pg_temp.debe_fallar('iniciar sin van ni conductor',
    format('UPDATE viajes SET estado = ''en-curso'', iniciado_en = now() WHERE id = %s', :ida),
    'viajes_recursos_check');
SELECT pg_temp.debe_fallar('en curso sin fecha de inicio',
    format('UPDATE viajes SET van_id = (SELECT max(id) FROM vans), conductor_id = %s, estado = ''en-curso'' WHERE id = %s', :carla, :ida),
    'viajes_fechas_estado_check');
SELECT pg_temp.debe_fallar('completado sin fecha de término',
    format('UPDATE viajes SET van_id = (SELECT max(id) FROM vans), conductor_id = %s, estado = ''completado'', iniciado_en = now() WHERE id = %s', :carla, :ida),
    'viajes_fechas_estado_check');
SELECT pg_temp.debe_fallar('cancelado sin fecha de cancelación',
    format('UPDATE viajes SET estado = ''cancelado'' WHERE id = %s', :ida),
    'viajes_fechas_estado_check');
SELECT pg_temp.debe_fallar('pendiente con fecha de cancelación',
    format('UPDATE viajes SET cancelado_en = now() WHERE id = %s', :ida),
    'viajes_fechas_estado_check');
SELECT pg_temp.debe_fallar('término antes del inicio',
    format($sql$
        UPDATE viajes SET van_id = (SELECT max(id) FROM vans), conductor_id = %s, estado = 'completado',
               iniciado_en = now(), finalizado_en = now() - INTERVAL '1 hour'
         WHERE id = %s
    $sql$, :carla, :ida),
    'viajes_fin_despues_inicio_check');

-- Un viaje activo por día y trayecto.
SELECT pg_temp.debe_fallar('dos viajes de ida el mismo día',
    :'ins' || format('(%s, %s, NULL, NULL, ''pendiente'', NULL, NULL, NULL)', :'dia', :'ida_ok'),
    'viajes_fecha_trayecto_activo_unique');
SELECT pg_temp.debe_funcionar('después de cancelar se puede abrir otro ese día',
    format($sql$
        UPDATE viajes SET estado = 'cancelado', cancelado_en = now() WHERE id = %s;
        INSERT INTO viajes (fecha, hora, trayecto, origen, destino)
        VALUES (CURRENT_DATE + 400, '06:45', 'Ida', 'Quillota 980', 'Santiago')
    $sql$, :ida));

-- Relaciones.
SELECT pg_temp.debe_fallar('conductor inexistente',
    format('UPDATE viajes SET conductor_id = -1 WHERE id = %s', :ida),
    'viajes_conductor_id_fkey');
SELECT pg_temp.debe_fallar('creador inexistente',
    format('UPDATE viajes SET creado_por = -1 WHERE id = %s', :ida),
    'viajes_creado_por_fkey');
SELECT pg_temp.debe_fallar('van inexistente',
    format('UPDATE viajes SET van_id = -1 WHERE id = %s', :ida),
    'viajes_van_id_fkey');
SELECT pg_temp.debe_fallar('una van con viajes no se puede borrar',
    format($sql$
        UPDATE viajes SET van_id = (SELECT max(id) FROM vans) WHERE id = %s;
        DELETE FROM vans WHERE id = (SELECT max(id) FROM vans)
    $sql$, :ida),
    'viajes_van_id_fkey');
SELECT pg_temp.debe_funcionar('al borrar al conductor el viaje se conserva sin conductor', format($sql$
DO $$
BEGIN
    UPDATE viajes SET conductor_id = %s WHERE id = %s;
    DELETE FROM usuarios WHERE id = %s;
    IF (SELECT conductor_id FROM viajes WHERE id = %s) IS NOT NULL THEN
        RAISE EXCEPTION 'el viaje sigue apuntando al conductor borrado';
    END IF;
END $$;
$sql$, :carla, :ida, :carla, :ida));

-- Trigger.
SELECT pg_temp.debe_funcionar('actualizado_en cambia al asignar la van', format($sql$
DO $$
DECLARE antes TIMESTAMPTZ; despues TIMESTAMPTZ;
BEGIN
    SELECT actualizado_en INTO antes FROM viajes WHERE id = %s;
    PERFORM pg_sleep(0.01);
    UPDATE viajes SET van_id = (SELECT max(id) FROM vans) WHERE id = %s;
    SELECT actualizado_en INTO despues FROM viajes WHERE id = %s;
    IF despues <= antes THEN
        RAISE EXCEPTION 'actualizado_en no cambió';
    END IF;
END $$;
$sql$, :ida, :ida, :ida));

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
