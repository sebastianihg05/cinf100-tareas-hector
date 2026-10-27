-- BD-06: usuarios de prueba para desarrollo. NO usar en producción.
-- Se puede ejecutar varias veces: solo inserta las cuentas que faltan.
--
-- Contraseña: la toma de la variable SEED_PASSWORD (archivo .env de la raíz).
-- Si no está definida, se usa una contraseña aleatoria: las cuentas existen
-- pero nadie puede iniciar sesión con ellas. El hash es bcrypt ($2a$),
-- compatible con las librerías bcrypt / bcryptjs de Node.js (BD-10).

SET client_min_messages = warning;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TEMP TABLE seed_clave ON COMMIT DROP AS
SELECT crypt(
         COALESCE(NULLIF(:'seed_password', ''),
                  ENCODE(gen_random_bytes(24), 'base64')),
         gen_salt('bf', 10)
       ) AS hash;

-- Administrador de desarrollo (sin sede).
INSERT INTO usuarios
    (nombre_completo, correo, hash_contrasena, telefono, sede,
     rol, estado_aprobacion)
SELECT 'Administrador Desarrollo', 'dev.admin@unab.cl', hash, '+56900000001', NULL,
       'administrador', 'aprobada'
  FROM seed_clave
 WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE correo = 'dev.admin@unab.cl');

-- Una cuenta por cada estado de aprobación, decididas por el administrador.
INSERT INTO usuarios
    (nombre_completo, correo, hash_contrasena, telefono, sede,
     rol, estado_aprobacion, decidido_por, decidido_en)
SELECT v.nombre, v.correo, c.hash, v.telefono, v.sede,
       v.rol, v.estado,
       CASE WHEN v.estado = 'pendiente' THEN NULL ELSE a.id END,
       CASE WHEN v.estado = 'pendiente' THEN NULL ELSE CURRENT_TIMESTAMP END
  FROM (VALUES
        ('Funcionario Aprobado',  'dev.funcionario@unab.cl',       '+56900000002', 'Quillota 980', 'funcionario', 'aprobada'),
        ('Conductor Aprobado',    'dev.conductor@unab.cl',         '+56900000003', 'Quillota 980', 'conductor',   'aprobada'),
        ('Funcionario Pendiente', 'dev.pendiente@uandresbello.edu', '+56900000004', 'Santiago',     NULL,          'pendiente'),
        ('Funcionario Rechazado', 'dev.rechazado@unab.cl',         '+56900000005', 'Quintay',      NULL,          'rechazada'),
        ('Funcionario Desactivado','dev.desactivado@unab.cl',      '+56900000006', 'Rokamar',      'funcionario', 'desactivada')
       ) AS v (nombre, correo, telefono, sede, rol, estado)
 CROSS JOIN seed_clave c
 CROSS JOIN (SELECT id FROM usuarios WHERE correo = 'dev.admin@unab.cl') a
 WHERE NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.correo = v.correo);

-- Si SEED_PASSWORD está definida, las cuentas de prueba quedan con esa
-- contraseña aunque ya existieran con otra (por ejemplo, una aleatoria).
UPDATE usuarios u
   SET hash_contrasena = c.hash
  FROM seed_clave c
 WHERE :'seed_password' <> ''
   AND u.correo = ANY (ARRAY[
         'dev.admin@unab.cl', 'dev.funcionario@unab.cl', 'dev.conductor@unab.cl',
         'dev.pendiente@uandresbello.edu', 'dev.rechazado@unab.cl', 'dev.desactivado@unab.cl'])
   AND u.hash_contrasena <> crypt(:'seed_password', u.hash_contrasena);