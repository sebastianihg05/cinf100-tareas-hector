-- S3-RES-04 (#2608) — Avisos de la campana que cada persona ya leyó.
-- Los avisos se calculan con las reservas y los viajes; aquí solo se guarda cuáles se marcaron como leídos,
-- así no queda nada de eso en el navegador.
-- El script migrate.sh la ejecuta dentro de una transacción.

CREATE TABLE avisos_leidos (
    -- Al borrar la cuenta se borran también sus avisos leídos.
    usuario_id INTEGER NOT NULL
        REFERENCES usuarios (id) ON DELETE CASCADE,
    -- Mismo id que arma el frontend: confirmada:<grupo_id>, en-curso:<reserva_id> o cancelado:<reserva_id>.
    aviso_id VARCHAR(80) NOT NULL,
    leido_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Un aviso se marca una sola vez por persona.
    PRIMARY KEY (usuario_id, aviso_id),

    CONSTRAINT avisos_leidos_aviso_id_check
        CHECK (aviso_id ~ '^[a-z-]+:[0-9a-f-]+$')
);
