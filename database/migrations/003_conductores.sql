-- Datos de conductor de las cuentas con rol conductor: RUT, licencia y si está activo.
-- El nombre, el correo y el celular siguen en la tabla usuarios.
-- El script migrate.sh la ejecuta dentro de una transacción.

CREATE TABLE conductores (
    usuario_id INTEGER PRIMARY KEY
        REFERENCES usuarios (id) ON DELETE CASCADE,
    rut VARCHAR(12),
    licencia_hasta DATE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- RUT con puntos y guion, por ejemplo 12.345.678-5
    CONSTRAINT conductores_rut_formato_check
        CHECK (rut IS NULL OR rut ~ '^[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9K]$')
);

-- Un RUT no se repite entre conductores.
CREATE UNIQUE INDEX conductores_rut_unique
    ON conductores (rut)
    WHERE rut IS NOT NULL;

CREATE TRIGGER conductores_actualizado_en
    BEFORE UPDATE ON conductores
    FOR EACH ROW EXECUTE FUNCTION fijar_actualizado_en();

-- Conductores que ya estaban aprobados: quedan sin RUT ni licencia hasta que el administrador los complete.
INSERT INTO conductores (usuario_id)
SELECT id FROM usuarios WHERE rol = 'conductor';
