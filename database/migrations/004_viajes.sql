-- S3-BD-02 (#2597) — Viajes del transporte institucional.
-- La van se guarda en van_id; su llave foránea la agrega la migración de vans (#2596).
-- El script migrate.sh la ejecuta dentro de una transacción.

CREATE TABLE viajes (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    trayecto VARCHAR(10) NOT NULL,
    origen VARCHAR(30) NOT NULL,
    destino VARCHAR(30) NOT NULL,
    -- NULL mientras la administración no asigna van y conductor.
    van_id INTEGER,
    conductor_id INTEGER
        REFERENCES conductores (usuario_id) ON DELETE SET NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    -- Quién abrió el viaje: un administrador o la Dirección de Docencia.
    creado_por INTEGER
        REFERENCES usuarios (id) ON DELETE SET NULL,
    iniciado_en TIMESTAMPTZ,
    finalizado_en TIMESTAMPTZ,
    cancelado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Solo Ida o Vuelta, con ruta y horario fijos:
    -- Ida 06:45 Quillota 980 -> Santiago, Vuelta 17:00 Santiago -> Quillota 980.
    CONSTRAINT viajes_ruta_check
        CHECK (
            (trayecto = 'Ida' AND origen = 'Quillota 980' AND destino = 'Santiago' AND hora = '06:45')
            OR (trayecto = 'Vuelta' AND origen = 'Santiago' AND destino = 'Quillota 980' AND hora = '17:00')
        ),

    CONSTRAINT viajes_estado_check
        CHECK (estado IN ('pendiente', 'en-curso', 'completado', 'cancelado')),

    -- Un viaje no puede iniciar ni terminar sin van y conductor.
    CONSTRAINT viajes_recursos_check
        CHECK (estado IN ('pendiente', 'cancelado') OR (van_id IS NOT NULL AND conductor_id IS NOT NULL)),

    -- Las fechas de cada cambio calzan con el estado.
    CONSTRAINT viajes_fechas_estado_check
        CHECK (
            (estado = 'pendiente' AND iniciado_en IS NULL AND finalizado_en IS NULL AND cancelado_en IS NULL)
            OR (estado = 'en-curso' AND iniciado_en IS NOT NULL AND finalizado_en IS NULL AND cancelado_en IS NULL)
            OR (estado = 'completado' AND iniciado_en IS NOT NULL AND finalizado_en IS NOT NULL AND cancelado_en IS NULL)
            OR (estado = 'cancelado' AND finalizado_en IS NULL AND cancelado_en IS NOT NULL)
        ),

    CONSTRAINT viajes_fin_despues_inicio_check
        CHECK (finalizado_en IS NULL OR finalizado_en >= iniciado_en)
);

-- Un solo viaje activo por día y trayecto (lo mismo que valida "Abrir viaje").
CREATE UNIQUE INDEX viajes_fecha_trayecto_activo_unique
    ON viajes (fecha, trayecto)
    WHERE estado <> 'cancelado';

-- Viajes de un conductor y búsqueda por fecha.
CREATE INDEX viajes_conductor_idx ON viajes (conductor_id);
CREATE INDEX viajes_fecha_idx ON viajes (fecha);

CREATE TRIGGER viajes_actualizado_en
    BEFORE UPDATE ON viajes
    FOR EACH ROW EXECUTE FUNCTION fijar_actualizado_en();
