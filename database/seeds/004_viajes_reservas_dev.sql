-- S3-BD-04 (#2599): viajes y reservas de prueba para desarrollo. NO usar en producción.
-- Las fechas son relativas al día en que se carga, para que siempre haya viajes próximos.
--
-- Escenarios (D = día de la carga):
--   D-2 Ida     completado, van FG-1251   reserva completada del funcionario (asiento 4)
--   D-1 Vuelta  cancelado                 reserva cancelada del funcionario (asiento 2)
--   D+2 Ida     pendiente, van FG-1251    reserva de ida y vuelta del funcionario (asientos 3 y 5)
--   D+2 Vuelta  pendiente, van FG-1251
--   D+3 Ida     pendiente, sin van        (por asignar)
--   D+5 Ida     pendiente, van SH-8568    sin conductor ni reservas
--
-- Solo se carga si la tabla viajes está vacía: al volver a ejecutarse (cada `docker compose up`)
-- no duplica viajes ni se mezcla con los que el equipo haya creado.

DO $$
DECLARE
    d DATE := CURRENT_DATE;
    admin_id INT;
    funcionario_id INT;
    id_conductor INT;
    van_fg INT;
    van_sh INT;
    v_completado INT;
    v_cancelado INT;
    v_ida INT;
    v_vuelta INT;
BEGIN
    IF EXISTS (SELECT 1 FROM viajes) THEN
        RAISE NOTICE 'seed de viajes omitido: la tabla viajes ya tiene datos';
        RETURN;
    END IF;

    SELECT id INTO admin_id FROM usuarios WHERE correo = 'dev.admin@unab.cl';
    SELECT id INTO funcionario_id FROM usuarios WHERE correo = 'dev.funcionario@unab.cl';
    SELECT id INTO van_fg FROM vans WHERE patente = 'FG-1251';
    SELECT id INTO van_sh FROM vans WHERE patente = 'SH-8568';
    -- El conductor de los viajes es el que maneja FG-1251, así viaje y van coinciden.
    SELECT v.conductor_id INTO id_conductor FROM vans v WHERE v.id = van_fg;

    IF funcionario_id IS NULL OR van_fg IS NULL OR van_sh IS NULL OR id_conductor IS NULL THEN
        RAISE NOTICE 'seed de viajes omitido: faltan las cuentas o vans de prueba (seeds 001 a 003)';
        RETURN;
    END IF;

    -- Viaje ya realizado.
    INSERT INTO viajes (fecha, hora, trayecto, origen, destino, van_id, conductor_id, estado,
                        creado_por, iniciado_en, finalizado_en)
    VALUES (d - 2, '06:45', 'Ida', 'Quillota 980', 'Santiago', van_fg, id_conductor, 'completado',
            admin_id, (d - 2) + TIME '06:50', (d - 2) + TIME '08:40')
    RETURNING id INTO v_completado;

    -- Viaje cancelado antes de salir.
    INSERT INTO viajes (fecha, hora, trayecto, origen, destino, estado, creado_por, cancelado_en)
    VALUES (d - 1, '17:00', 'Vuelta', 'Santiago', 'Quillota 980', 'cancelado',
            admin_id, (d - 3) + TIME '10:00')
    RETURNING id INTO v_cancelado;

    -- Próximos viajes.
    INSERT INTO viajes (fecha, hora, trayecto, origen, destino, van_id, conductor_id, creado_por)
    VALUES (d + 2, '06:45', 'Ida', 'Quillota 980', 'Santiago', van_fg, id_conductor, admin_id)
    RETURNING id INTO v_ida;

    INSERT INTO viajes (fecha, hora, trayecto, origen, destino, van_id, conductor_id, creado_por)
    VALUES (d + 2, '17:00', 'Vuelta', 'Santiago', 'Quillota 980', van_fg, id_conductor, admin_id)
    RETURNING id INTO v_vuelta;

    INSERT INTO viajes (fecha, hora, trayecto, origen, destino, creado_por)
    VALUES (d + 3, '06:45', 'Ida', 'Quillota 980', 'Santiago', admin_id);

    INSERT INTO viajes (fecha, hora, trayecto, origen, destino, van_id, creado_por)
    VALUES (d + 5, '06:45', 'Ida', 'Quillota 980', 'Santiago', van_sh, admin_id);

    -- Reservas del funcionario de prueba. Ida y vuelta comparten grupo.
    INSERT INTO reservas (grupo_id, usuario_id, viaje_id, asiento, estado)
    VALUES (gen_random_uuid(), funcionario_id, v_completado, 4, 'completada');

    INSERT INTO reservas (grupo_id, usuario_id, viaje_id, asiento, estado, cancelada_en)
    VALUES (gen_random_uuid(), funcionario_id, v_cancelado, 2, 'cancelada', (d - 3) + TIME '10:00');

    WITH grupo AS (SELECT gen_random_uuid() AS id)
    INSERT INTO reservas (grupo_id, usuario_id, viaje_id, asiento)
    SELECT grupo.id, funcionario_id, t.viaje_id, t.asiento
      FROM grupo, (VALUES (v_ida, 3), (v_vuelta, 5)) AS t (viaje_id, asiento);
END $$;
