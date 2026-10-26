-- BD-05 / BD-07: pruebas automáticas de la tabla usuarios.
-- Todo corre dentro de una transacción que se revierte: no deja datos.
--
-- Ejecutar (con los contenedores levantados):
--   docker compose exec database psql -U devhub -d cinf100 -f /database/tests/usuarios_restricciones.sql

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

-- Datos base de los casos.
\set h '''$2a$10$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz01234'''
\set ins 'INSERT INTO usuarios (nombre_completo, correo, hash_contrasena, telefono, sede, rol, estado_aprobacion) VALUES '

-- Oculta la salida de cada caso; el resumen va al final.
\o /dev/null

SELECT pg_temp.debe_funcionar('registro válido queda pendiente',
    :'ins' || format('(''Ana Pérez'', ''ana.test@unab.cl'', %s, ''+56912345678'', ''Quintay'', NULL, ''pendiente'')', :'h'));
SELECT pg_temp.debe_funcionar('correo @uandresbello.edu',
    :'ins' || format('(''Ana'', ''ana.test@uandresbello.edu'', %s, ''+56912345678'', ''Quintay'', NULL, ''pendiente'')', :'h'));
SELECT pg_temp.debe_funcionar('administrador sin sede',
    :'ins' || format('(''Admin'', ''admin.test@unab.cl'', %s, ''+56912345678'', NULL, ''administrador'', ''aprobada'')', :'h'));
SELECT pg_temp.debe_funcionar('hash Argon2id',
    :'ins' || '(''Ana'', ''ana.test@unab.cl'', ''$argon2id$v=19$m=65536,t=3,p=4$abc'', ''+56912345678'', ''Quintay'', NULL, ''pendiente'')');

SELECT pg_temp.debe_fallar('correo gmail',
    :'ins' || format('(''Ana'', ''ana@gmail.com'', %s, ''+56912345678'', ''Quintay'', NULL, ''pendiente'')', :'h'),
    'usuarios_correo_institucional_check');
SELECT pg_temp.debe_fallar('correo con mayúsculas',
    :'ins' || format('(''Ana'', ''Ana.Test@unab.cl'', %s, ''+56912345678'', ''Quintay'', NULL, ''pendiente'')', :'h'),
    'usuarios_correo_minusculas_check');
SELECT pg_temp.debe_fallar('correo duplicado',
    :'ins' || format('(''Ana'', ''dup.test@unab.cl'', %1$s, ''+56912345678'', ''Quintay'', NULL, ''pendiente''), (''Ana 2'', ''dup.test@unab.cl'', %1$s, ''+56912345678'', ''Quintay'', NULL, ''pendiente'')', :'h'),
    'usuarios_correo_unique_ci');
SELECT pg_temp.debe_fallar('nombre vacío',
    :'ins' || format('(''   '', ''ana.test@unab.cl'', %s, ''+56912345678'', ''Quintay'', NULL, ''pendiente'')', :'h'),
    'usuarios_nombre_no_vacio_check');
SELECT pg_temp.debe_fallar('nombre ausente',
    'INSERT INTO usuarios (correo, hash_contrasena, telefono, sede) VALUES (''ana.test@unab.cl'', ' || :'h' || ', ''+56912345678'', ''Quintay'')',
    'null value in column "nombre_completo"');
SELECT pg_temp.debe_fallar('contraseña en texto plano',
    :'ins' || '(''Ana'', ''ana.test@unab.cl'', ''Unab.2026'', ''+56912345678'', ''Quintay'', NULL, ''pendiente'')',
    'usuarios_hash_contrasena_check');
SELECT pg_temp.debe_fallar('teléfono con letras',
    :'ins' || format('(''Ana'', ''ana.test@unab.cl'', %s, ''abc'', ''Quintay'', NULL, ''pendiente'')', :'h'),
    'usuarios_telefono_check');
SELECT pg_temp.debe_fallar('teléfono con espacios',
    :'ins' || format('(''Ana'', ''ana.test@unab.cl'', %s, ''+56 9 1234 5678'', ''Quintay'', NULL, ''pendiente'')', :'h'),
    'usuarios_telefono_check');
SELECT pg_temp.debe_fallar('sede no permitida',
    :'ins' || format('(''Ana'', ''ana.test@unab.cl'', %s, ''+56912345678'', ''Concepcion'', NULL, ''pendiente'')', :'h'),
    'usuarios_sede_check');
SELECT pg_temp.debe_fallar('funcionario sin sede',
    :'ins' || format('(''Ana'', ''ana.test@unab.cl'', %s, ''+56912345678'', NULL, ''funcionario'', ''aprobada'')', :'h'),
    'usuarios_sede_segun_rol_check');
SELECT pg_temp.debe_fallar('administrador con sede',
    :'ins' || format('(''Admin'', ''admin.test@unab.cl'', %s, ''+56912345678'', ''Quintay'', ''administrador'', ''aprobada'')', :'h'),
    'usuarios_sede_segun_rol_check');
SELECT pg_temp.debe_fallar('rol no definido',
    :'ins' || format('(''Ana'', ''ana.test@unab.cl'', %s, ''+56912345678'', ''Quintay'', ''supervisor'', ''aprobada'')', :'h'),
    'usuarios_rol_check');
SELECT pg_temp.debe_fallar('estado no definido',
    :'ins' || format('(''Ana'', ''ana.test@unab.cl'', %s, ''+56912345678'', ''Quintay'', NULL, ''en_revision'')', :'h'),
    'usuarios_estado_check');
SELECT pg_temp.debe_fallar('pendiente con rol',
    :'ins' || format('(''Ana'', ''ana.test@unab.cl'', %s, ''+56912345678'', ''Quintay'', ''funcionario'', ''pendiente'')', :'h'),
    'usuarios_estado_rol_check');
SELECT pg_temp.debe_fallar('aprobada sin rol',
    :'ins' || format('(''Ana'', ''ana.test@unab.cl'', %s, ''+56912345678'', ''Quintay'', NULL, ''aprobada'')', :'h'),
    'usuarios_estado_rol_check');
SELECT pg_temp.debe_fallar('pendiente con decisión registrada',
    'INSERT INTO usuarios (nombre_completo, correo, hash_contrasena, telefono, sede, decidido_en) VALUES (''Ana'', ''ana.test@unab.cl'', ' || :'h' || ', ''+56912345678'', ''Quintay'', now())',
    'usuarios_decision_check');
SELECT pg_temp.debe_fallar('id escrito a mano',
    'INSERT INTO usuarios (id, nombre_completo, correo, hash_contrasena, telefono, sede) VALUES (999, ''Ana'', ''ana.test@unab.cl'', ' || :'h' || ', ''+56912345678'', ''Quintay'')',
    'cannot insert a non-DEFAULT value into column "id"');

-- Flujo de aprobación: pendiente -> aprobada con rol, registra quién y cuándo,
-- y actualizado_en cambia solo.
SELECT pg_temp.debe_funcionar('aprobar registra decisión y actualizado_en', $sql$
DO $$
DECLARE nuevo INT; admin INT; antes TIMESTAMPTZ; r usuarios;
BEGIN
    INSERT INTO usuarios (nombre_completo, correo, hash_contrasena, telefono, sede, rol, estado_aprobacion)
    VALUES ('Admin', 'flujo.admin@unab.cl', '$2a$10$x', '+56911111111', NULL, 'administrador', 'aprobada')
    RETURNING id INTO admin;
    INSERT INTO usuarios (nombre_completo, correo, hash_contrasena, telefono, sede)
    VALUES ('Nuevo', 'flujo.nuevo@unab.cl', '$2a$10$x', '+56922222222', 'Quintay')
    RETURNING id, actualizado_en INTO nuevo, antes;
    PERFORM pg_sleep(0.01);
    UPDATE usuarios SET estado_aprobacion = 'aprobada', rol = 'funcionario',
           decidido_por = admin, decidido_en = clock_timestamp()
     WHERE id = nuevo;
    SELECT * INTO r FROM usuarios WHERE id = nuevo;
    IF r.decidido_por <> admin OR r.actualizado_en <= antes THEN
        RAISE EXCEPTION 'la aprobación no quedó registrada';
    END IF;
END $$;
$sql$);

SELECT pg_temp.debe_fallar('un usuario no puede aprobarse a sí mismo', $sql$
DO $$
DECLARE nuevo INT;
BEGIN
    INSERT INTO usuarios (nombre_completo, correo, hash_contrasena, telefono, sede)
    VALUES ('Nuevo', 'auto.test@unab.cl', '$2a$10$x', '+56922222222', 'Quintay')
    RETURNING id INTO nuevo;
    UPDATE usuarios SET estado_aprobacion = 'aprobada', rol = 'funcionario',
           decidido_por = nuevo, decidido_en = now()
     WHERE id = nuevo;
END $$;
$sql$, 'usuarios_no_autoaprobacion_check');

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
