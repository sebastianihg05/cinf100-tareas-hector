-- Datos de conductor de la cuenta de prueba dev.conductor@unab.cl. NO usar en producción.
-- Coinciden con el conductor de ejemplo Juan Carrasco del frontend.
-- Se puede ejecutar varias veces: no pisa lo que el administrador ya haya cambiado.

INSERT INTO conductores (usuario_id)
SELECT id FROM usuarios WHERE correo = 'dev.conductor@unab.cl'
ON CONFLICT (usuario_id) DO NOTHING;

UPDATE conductores c
   SET rut = '13.987.654-7'
  FROM usuarios u
 WHERE u.id = c.usuario_id
   AND u.correo = 'dev.conductor@unab.cl'
   AND c.rut IS NULL
   AND NOT EXISTS (SELECT 1 FROM conductores o WHERE o.rut = '13.987.654-7');

UPDATE conductores c
   SET licencia_hasta = DATE '2027-09-06'
  FROM usuarios u
 WHERE u.id = c.usuario_id
   AND u.correo = 'dev.conductor@unab.cl'
   AND c.licencia_hasta IS NULL;
