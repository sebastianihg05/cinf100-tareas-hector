-- S3-BD-03 (#2598) — Reservas de asientos de los funcionarios.
-- Cada reserva apunta a un viaje (004_viajes.sql) y a la cuenta que reserva.
-- El script migrate.sh la ejecuta dentro de una transacción.

CREATE TABLE reservas (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- Una reserva de ida y vuelta son dos filas (una por viaje) con el mismo grupo.
    grupo_id UUID NOT NULL,
    usuario_id INTEGER NOT NULL
        REFERENCES usuarios (id) ON DELETE CASCADE,
    -- RESTRICT: un viaje con reservas no se borra, se cancela, y el historial se conserva.
    viaje_id INTEGER NOT NULL
        REFERENCES viajes (id) ON DELETE RESTRICT,
    asiento SMALLINT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    cancelada_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Hyundai Staria: asientos 1 a 9. El copiloto no tiene número, así que no se puede reservar.
    CONSTRAINT reservas_asiento_check
        CHECK (asiento BETWEEN 1 AND 9),

    CONSTRAINT reservas_estado_check
        CHECK (estado IN ('pendiente', 'completada', 'cancelada')),

    -- Solo las canceladas tienen fecha de cancelación.
    CONSTRAINT reservas_cancelada_en_check
        CHECK ((estado = 'cancelada') = (cancelada_en IS NOT NULL)),

    -- Un grupo no repite viaje.
    CONSTRAINT reservas_grupo_viaje_unique
        UNIQUE (grupo_id, viaje_id)
);

-- Un asiento no se repite entre las reservas activas de un mismo viaje.
-- Si dos funcionarios reservan el mismo asiento a la vez, PostgreSQL rechaza al segundo.
CREATE UNIQUE INDEX reservas_asiento_activo_unique
    ON reservas (viaje_id, asiento)
    WHERE estado <> 'cancelada';

-- Una persona tiene como máximo una reserva activa por viaje.
CREATE UNIQUE INDEX reservas_usuario_viaje_activo_unique
    ON reservas (usuario_id, viaje_id)
    WHERE estado <> 'cancelada';

-- "Mis reservas" del funcionario y los trayectos de un mismo grupo.
CREATE INDEX reservas_usuario_idx ON reservas (usuario_id);
CREATE INDEX reservas_grupo_idx ON reservas (grupo_id);

CREATE TRIGGER reservas_actualizado_en
    BEFORE UPDATE ON reservas
    FOR EACH ROW EXECUTE FUNCTION fijar_actualizado_en();
