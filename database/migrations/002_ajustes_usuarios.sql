-- BD-03 / BD-05: completa la tabla usuarios con las decisiones del 23-10
-- y permite que el administrador no tenga sede.
-- El script migrate.sh la ejecuta dentro de una transacción.

-- 1. Correo siempre en minúsculas.
UPDATE usuarios SET correo = LOWER(correo) WHERE correo <> LOWER(correo);

ALTER TABLE usuarios
    ADD CONSTRAINT usuarios_correo_minusculas_check
        CHECK (correo = LOWER(correo));

-- 2. Nombre no vacío.
ALTER TABLE usuarios
    ADD CONSTRAINT usuarios_nombre_no_vacio_check
        CHECK (BTRIM(nombre_completo) <> '');

-- 3. La contraseña solo se guarda como hash bcrypt o Argon2id, nunca en texto plano.
ALTER TABLE usuarios
    ADD CONSTRAINT usuarios_hash_contrasena_check
        CHECK (hash_contrasena ~ '^\$(2[aby]|argon2id)\$');

-- 4. Teléfono celular chileno con formato único: +569XXXXXXXX.
--    Normaliza los que ya existan (por ejemplo '+56 9 1234 5678' o '912345678').
UPDATE usuarios
   SET telefono = '+56' || RIGHT(REGEXP_REPLACE(telefono, '\D', '', 'g'), 9)
 WHERE telefono !~ '^\+569[0-9]{8}$'
   AND REGEXP_REPLACE(telefono, '\D', '', 'g') ~ '^(56)?9[0-9]{8}$';

ALTER TABLE usuarios
    ADD CONSTRAINT usuarios_telefono_check
        CHECK (telefono ~ '^\+569[0-9]{8}$');

-- 5. El administrador no tiene sede; el resto de las cuentas sí.
ALTER TABLE usuarios
    ALTER COLUMN sede DROP NOT NULL,
    ADD CONSTRAINT usuarios_sede_segun_rol_check
        CHECK (
            (rol = 'administrador' AND sede IS NULL)
            OR
            (rol IS DISTINCT FROM 'administrador' AND sede IS NOT NULL)
        );

-- 6. Quién aprobó o rechazó la cuenta, y cuándo.
ALTER TABLE usuarios
    ADD COLUMN decidido_por INTEGER
        REFERENCES usuarios (id) ON DELETE SET NULL,
    ADD COLUMN decidido_en TIMESTAMPTZ,
    ADD CONSTRAINT usuarios_decision_check
        CHECK (
            (estado_aprobacion = 'pendiente'
                AND decidido_por IS NULL AND decidido_en IS NULL)
            OR
            (estado_aprobacion <> 'pendiente'
                AND (decidido_por IS NULL OR decidido_en IS NOT NULL))
        ),
    ADD CONSTRAINT usuarios_no_autoaprobacion_check
        CHECK (decidido_por IS DISTINCT FROM id);

-- 7. Fecha de última modificación, mantenida por PostgreSQL.
ALTER TABLE usuarios
    ADD COLUMN actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE FUNCTION fijar_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER usuarios_actualizado_en
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION fijar_actualizado_en();

-- 8. Búsqueda rápida de solicitudes pendientes (BD-15).
CREATE INDEX usuarios_pendientes_idx
    ON usuarios (creado_en)
    WHERE estado_aprobacion = 'pendiente';
