CREATE TABLE usuarios (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_completo VARCHAR(150) NOT NULL,
    correo VARCHAR(254) NOT NULL,
    hash_contrasena VARCHAR(255) NOT NULL,
    telefono VARCHAR(16) NOT NULL,
    sede VARCHAR(30) NOT NULL,
    rol VARCHAR(20),
    estado_aprobacion VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultimo_ingreso_en TIMESTAMPTZ,

    CONSTRAINT usuarios_correo_institucional_check
        CHECK (
            correo ~* '^[^@[:space:]]+@(unab\.cl|uandresbello\.edu)$'
        ),

    CONSTRAINT usuarios_sede_check
        CHECK (
            sede IN ('Quillota 980', 'Quintay', 'Rokamar', 'Santiago')
        ),

    CONSTRAINT usuarios_rol_check
        CHECK (
            rol IS NULL OR
            rol IN ('administrador', 'funcionario', 'conductor')
        ),

    CONSTRAINT usuarios_estado_check
        CHECK (
            estado_aprobacion IN (
                'pendiente', 'aprobada', 'rechazada', 'desactivada'
            )
        ),

    CONSTRAINT usuarios_estado_rol_check
        CHECK (
            (estado_aprobacion IN ('pendiente', 'rechazada')
                AND rol IS NULL)
            OR
            (estado_aprobacion IN ('aprobada', 'desactivada')
                AND rol IS NOT NULL)
        )
);

CREATE UNIQUE INDEX usuarios_correo_unique_ci
    ON usuarios (LOWER(correo));