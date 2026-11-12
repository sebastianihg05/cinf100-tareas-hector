-- S3-BD-04 (#2599): vans de prueba para desarrollo. NO usar en producción.
-- Mismas patentes que el frontend (admin/data/mock.ts). Una van por escenario:
--   FG-1251  activa, con el conductor de prueba dev.conductor@unab.cl
--   SH-8568  activa, sin conductor
--   CO-6768  dada de baja
-- Se puede ejecutar varias veces: no duplica vans ni pisa lo que el administrador ya haya cambiado.

INSERT INTO vans (patente, activa)
VALUES ('FG-1251', TRUE), ('SH-8568', TRUE), ('CO-6768', FALSE)
ON CONFLICT (patente) DO NOTHING;

-- El conductor de prueba maneja FG-1251, solo si sigue activo, la van no tiene conductor
-- y él no maneja otra (un conductor, una van).
UPDATE vans v
   SET conductor_id = c.usuario_id
  FROM conductores c
  JOIN usuarios u ON u.id = c.usuario_id
 WHERE v.patente = 'FG-1251'
   AND v.activa
   AND v.conductor_id IS NULL
   AND u.correo = 'dev.conductor@unab.cl'
   AND c.activo
   AND NOT EXISTS (SELECT 1 FROM vans o WHERE o.conductor_id = c.usuario_id);
