-- Completa la ficha en conductores de las cuentas con rol conductor que no la tienen.
-- La aprobación (POST /api/admin/solicitudes/:id/aprobar) ya crea la ficha, pero una cuenta cargada por otra vía
-- (seed, Adminer o datos anteriores a 003_conductores.sql) podía quedar sin ella. Sin ficha, el panel no tiene
-- el id del conductor y la van no se puede asignar («El conductor seleccionado todavía no está registrado…»).
-- Las fichas nuevas quedan sin RUT ni licencia, igual que en 003, hasta que el administrador las complete.
-- No cambia las fichas que ya existen. El script migrate.sh la ejecuta dentro de una transacción.

INSERT INTO conductores (usuario_id)
SELECT id
  FROM usuarios
 WHERE rol = 'conductor'
   AND estado_aprobacion IN ('aprobada', 'desactivada')
ON CONFLICT (usuario_id) DO NOTHING;
