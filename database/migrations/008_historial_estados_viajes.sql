CREATE TABLE IF NOT EXISTS viajes_historial_estados (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    viaje_id INTEGER NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
    estado_anterior VARCHAR(20) NOT NULL,
    estado_nuevo VARCHAR(20) NOT NULL,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT viajes_historial_estado_anterior_check
        CHECK (estado_anterior IN ('pendiente', 'en-curso', 'completado', 'cancelado')),

    CONSTRAINT viajes_historial_estado_nuevo_check
        CHECK (estado_nuevo IN ('pendiente', 'en-curso', 'completado', 'cancelado')),

    CONSTRAINT viajes_historial_transicion_check
        CHECK (
            (estado_anterior = 'pendiente' AND estado_nuevo IN ('en-curso', 'cancelado'))
            OR (estado_anterior = 'en-curso' AND estado_nuevo = 'completado')
        )
);

CREATE INDEX IF NOT EXISTS viajes_historial_estados_viaje_fecha_idx
    ON viajes_historial_estados (viaje_id, fecha_hora);