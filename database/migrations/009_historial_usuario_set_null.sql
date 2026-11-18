-- Revisión de 008_historial_estados_viajes.sql.
-- La llave usuario_id no tenía ON DELETE: si una cuenta había iniciado, finalizado o cancelado un viaje,
-- PostgreSQL no dejaba borrarla. Ahora el historial se conserva y solo pierde quién hizo el cambio,
-- igual que viajes.creado_por en 004_viajes.sql.
-- 008 no se modifica porque ya está aplicada en las bases del equipo.
-- El script migrate.sh la ejecuta dentro de una transacción.

ALTER TABLE viajes_historial_estados
    ALTER COLUMN usuario_id DROP NOT NULL;

ALTER TABLE viajes_historial_estados
    DROP CONSTRAINT viajes_historial_estados_usuario_id_fkey;

ALTER TABLE viajes_historial_estados
    ADD CONSTRAINT viajes_historial_estados_usuario_id_fkey
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL;
