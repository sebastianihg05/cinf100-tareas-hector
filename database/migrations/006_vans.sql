-- S3-BD-01 (#2596) — Vans del transporte institucional.
-- Reutiliza la tabla conductores (003) y completa la llave foránea viajes.van_id que dejó pendiente 004_viajes.sql.
-- El script migrate.sh la ejecuta dentro de una transacción.

CREATE TABLE vans (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    patente VARCHAR(7) NOT NULL,
    -- Hyundai Staria: 9 asientos reservables (el copiloto no se reserva). Mismo tope que reservas.asiento.
    capacidad SMALLINT NOT NULL DEFAULT 9,
    -- Las vans no se borran, se dan de baja: así sus viajes conservan el historial.
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    -- NULL mientras la administración no asigna conductor.
    conductor_id INTEGER
        REFERENCES conductores (usuario_id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Patente chilena en mayúsculas y con guion, como la guarda el frontend: FG-1251 o BBCD-12.
    CONSTRAINT vans_patente_formato_check
        CHECK (patente ~ '^([A-Z]{2}-[0-9]{4}|[A-Z]{4}-[0-9]{2})$'),

    CONSTRAINT vans_capacidad_check
        CHECK (capacidad BETWEEN 1 AND 9),

    -- Una van dada de baja no tiene conductor (el frontend lo libera al darla de baja).
    CONSTRAINT vans_baja_sin_conductor_check
        CHECK (activa OR conductor_id IS NULL)
);

-- Una patente no se repite.
CREATE UNIQUE INDEX vans_patente_unique ON vans (patente);

-- Un conductor maneja una sola van.
CREATE UNIQUE INDEX vans_conductor_unique
    ON vans (conductor_id)
    WHERE conductor_id IS NOT NULL;

CREATE TRIGGER vans_actualizado_en
    BEFORE UPDATE ON vans
    FOR EACH ROW EXECUTE FUNCTION fijar_actualizado_en();

-- No se asigna un conductor dado de baja a una van. Si el conductor no existe, responde la llave foránea.
CREATE FUNCTION vans_validar_conductor() RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM conductores WHERE usuario_id = NEW.conductor_id AND NOT activo) THEN
        RAISE EXCEPTION 'el conductor % está dado de baja y no puede tener van', NEW.conductor_id
            USING ERRCODE = 'check_violation', CONSTRAINT = 'vans_conductor_activo_check';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vans_conductor_activo
    BEFORE INSERT OR UPDATE OF conductor_id ON vans
    FOR EACH ROW EXECUTE FUNCTION vans_validar_conductor();

-- Al dar de baja a un conductor, su van queda sin conductor (igual que el frontend).
CREATE FUNCTION conductores_liberar_van() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.activo AND NOT NEW.activo THEN
        UPDATE vans SET conductor_id = NULL WHERE conductor_id = NEW.usuario_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conductores_baja_libera_van
    AFTER UPDATE OF activo ON conductores
    FOR EACH ROW EXECUTE FUNCTION conductores_liberar_van();

-- Viajes: la van asignada debe existir. RESTRICT porque las vans no se borran, se dan de baja.
ALTER TABLE viajes
    ADD CONSTRAINT viajes_van_id_fkey
    FOREIGN KEY (van_id) REFERENCES vans (id) ON DELETE RESTRICT;

CREATE INDEX viajes_van_idx ON viajes (van_id);
