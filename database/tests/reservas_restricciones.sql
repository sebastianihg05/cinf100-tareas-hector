-- S3-BD-03 (#2598): pruebas automáticas de la tabla reservas.
-- Todo corre dentro de una transacción que se revierte: no deja datos.
--
-- Ejecutar (con los contenedores levantados):
--   docker compose exec database psql -U devhub -d cinf100 -f /database/tests/reservas_restricciones.sql

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

-- Datos base: dos funcionarios y dos viajes (ida y vuelta del mismo día).
INSERT INTO usuarios (nombre_completo, correo, hash_contrasena, telefono, sede)
VALUES ('Ana Reserva', 'ana.reserva.test@unab.cl', '$2a$10$x', '+56911111111', 'Quintay')
RETURNING id AS ana \gset
INSERT INTO usuarios (nombre_completo, correo, hash_contrasena, telefono, sede)
VALUES ('Beto Reserva', 'beto.reserva.test@unab.cl', '$2a$10$x', '+56922222222', 'Quintay')
RETURNING id AS beto \gset

-- Fecha lejana para no chocar con otros viajes del mismo día.
INSERT INTO viajes (fecha, hora, trayecto, origen, destino)
VALUES (CURRENT_DATE + 400, '06:45', 'Ida', 'Quillota 980', 'Santiago')
RETURNING id AS ida \gset
INSERT INTO viajes (fecha, hora, trayecto, origen, destino)
VALUES (CURRENT_DATE + 400, '17:00', 'Vuelta', 'Santiago', 'Quillota 980')
RETURNING id AS vuelta \gset

-- Reserva activa de Ana: asiento 1 de la ida.
INSERT INTO reservas (grupo_id, usuario_id, viaje_id, asiento)
VALUES ('11111111-1111-1111-1111-111111111111', :ana, :ida, 1);

\set ins 'INSERT INTO reservas (grupo_id, usuario_id, viaje_id, asiento, estado, cancelada_en) VALUES '

-- Datos válidos.
SELECT pg_temp.debe_funcionar('reserva válida queda pendiente',
    :'ins' || format('(gen_random_uuid(), %s, %s, 2, ''pendiente'', NULL)', :beto, :ida));
SELECT pg_temp.debe_funcionar('ida y vuelta: dos viajes con el mismo grupo',
    :'ins' || format('(''22222222-2222-2222-2222-222222222222'', %s, %s, 3, ''pendiente'', NULL),
                      (''22222222-2222-2222-2222-222222222222'', %s, %s, 3, ''pendiente'', NULL)', :beto, :ida, :beto, :vuelta));
SELECT pg_temp.debe_funcionar('el mismo asiento en otro viaje',
    :'ins' || format('(gen_random_uuid(), %s, %s, 1, ''pendiente'', NULL)', :beto, :vuelta));
SELECT pg_temp.debe_funcionar('asiento 9, el último de la Staria',
    :'ins' || format('(gen_random_uuid(), %s, %s, 9, ''pendiente'', NULL)', :beto, :ida));

-- Asiento.
SELECT pg_temp.debe_fallar('asiento 0 no existe',
    :'ins' || format('(gen_random_uuid(), %s, %s, 0, ''pendiente'', NULL)', :beto, :ida),
    'reservas_asiento_check');
SELECT pg_temp.debe_fallar('asiento 10 no existe (copiloto sin número)',
    :'ins' || format('(gen_random_uuid(), %s, %s, 10, ''pendiente'', NULL)', :beto, :ida),
    'reservas_asiento_check');

-- Estado.
SELECT pg_temp.debe_fallar('estado inválido',
    :'ins' || format('(gen_random_uuid(), %s, %s, 2, ''confirmada'', NULL)', :beto, :ida),
    'reservas_estado_check');
SELECT pg_temp.debe_fallar('cancelada sin fecha de cancelación',
    :'ins' || format('(gen_random_uuid(), %s, %s, 2, ''cancelada'', NULL)', :beto, :ida),
    'reservas_cancelada_en_check');
SELECT pg_temp.debe_fallar('pendiente con fecha de cancelación',
    :'ins' || format('(gen_random_uuid(), %s, %s, 2, ''pendiente'', now())', :beto, :ida),
    'reservas_cancelada_en_check');

-- Asientos duplicados.
SELECT pg_temp.debe_fallar('asiento ocupado en el mismo viaje',
    :'ins' || format('(gen_random_uuid(), %s, %s, 1, ''pendiente'', NULL)', :beto, :ida),
    'reservas_asiento_activo_unique');
SELECT pg_temp.debe_fallar('una reserva completada también ocupa el asiento',
    format($sql$
        UPDATE reservas SET estado = 'completada' WHERE usuario_id = %s;
        INSERT INTO reservas (grupo_id, usuario_id, viaje_id, asiento)
        VALUES (gen_random_uuid(), %s, %s, 1)
    $sql$, :ana, :beto, :ida),
    'reservas_asiento_activo_unique');
SELECT pg_temp.debe_funcionar('al cancelar, el asiento queda libre',
    format($sql$
        UPDATE reservas SET estado = 'cancelada', cancelada_en = now() WHERE usuario_id = %s;
        INSERT INTO reservas (grupo_id, usuario_id, viaje_id, asiento)
        VALUES (gen_random_uuid(), %s, %s, 1)
    $sql$, :ana, :beto, :ida));
SELECT pg_temp.debe_fallar('cambiar a un asiento ocupado',
    format($sql$
        INSERT INTO reservas (grupo_id, usuario_id, viaje_id, asiento)
        VALUES (gen_random_uuid(), %s, %s, 4);
        UPDATE reservas SET asiento = 1 WHERE usuario_id = %s AND viaje_id = %s
    $sql$, :beto, :ida, :beto, :ida),
    'reservas_asiento_activo_unique');

-- Una reserva activa por persona y viaje.
SELECT pg_temp.debe_fallar('la misma persona dos veces en un viaje',
    :'ins' || format('(gen_random_uuid(), %s, %s, 5, ''pendiente'', NULL)', :ana, :ida),
    'reservas_usuario_viaje_activo_unique');
SELECT pg_temp.debe_funcionar('después de cancelar puede volver a reservar',
    format($sql$
        UPDATE reservas SET estado = 'cancelada', cancelada_en = now() WHERE usuario_id = %s;
        INSERT INTO reservas (grupo_id, usuario_id, viaje_id, asiento)
        VALUES (gen_random_uuid(), %s, %s, 5)
    $sql$, :ana, :ana, :ida));
SELECT pg_temp.debe_fallar('un grupo no repite viaje',
    format($sql$
        UPDATE reservas SET estado = 'cancelada', cancelada_en = now() WHERE usuario_id = %s;
        INSERT INTO reservas (grupo_id, usuario_id, viaje_id, asiento)
        VALUES ('11111111-1111-1111-1111-111111111111', %s, %s, 6)
    $sql$, :ana, :ana, :ida),
    'reservas_grupo_viaje_unique');

-- Relaciones.
SELECT pg_temp.debe_fallar('usuario inexistente',
    :'ins' || format('(gen_random_uuid(), -1, %s, 2, ''pendiente'', NULL)', :ida),
    'reservas_usuario_id_fkey');
SELECT pg_temp.debe_fallar('viaje inexistente',
    :'ins' || format('(gen_random_uuid(), %s, -1, 2, ''pendiente'', NULL)', :beto),
    'reservas_viaje_id_fkey');
SELECT pg_temp.debe_fallar('un viaje con reservas no se puede borrar',
    format('DELETE FROM viajes WHERE id = %s', :ida),
    'reservas_viaje_id_fkey');
SELECT pg_temp.debe_funcionar('al borrar una cuenta se borran sus reservas', format($sql$
DO $$
BEGIN
    DELETE FROM usuarios WHERE id = %s;
    IF EXISTS (SELECT 1 FROM reservas WHERE usuario_id = %s) THEN
        RAISE EXCEPTION 'quedaron reservas de la cuenta borrada';
    END IF;
END $$;
$sql$, :ana, :ana));

-- Trigger.
SELECT pg_temp.debe_funcionar('actualizado_en cambia al editar el asiento', format($sql$
DO $$
DECLARE antes TIMESTAMPTZ; despues TIMESTAMPTZ;
BEGIN
    SELECT actualizado_en INTO antes FROM reservas WHERE usuario_id = %s;
    PERFORM pg_sleep(0.01);
    UPDATE reservas SET asiento = 7 WHERE usuario_id = %s;
    SELECT actualizado_en INTO despues FROM reservas WHERE usuario_id = %s;
    IF despues <= antes THEN
        RAISE EXCEPTION 'actualizado_en no cambió';
    END IF;
END $$;
$sql$, :ana, :ana, :ana));

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
