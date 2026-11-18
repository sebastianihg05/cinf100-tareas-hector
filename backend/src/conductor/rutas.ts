import { Router } from 'express';
import { requiereRol, requiereSesion } from '../auth/middleware';
import { aConductor, COLUMNAS_CONDUCTOR, type FilaConductor } from '../admin/conductores';
import { aVan, COLUMNAS_VAN, type FilaVan } from '../admin/vans';
import { pool } from '../db';
import { COLUMNAS_VIAJE, conReservas, idValido, viajePorId, type FilaViaje } from '../viajes/modelo';
import { ErrorRuta, rutaHaciaDestino } from '../viajes/rutas-mapa';
import { coordenadasDeSede } from '../viajes/sedes';

// Panel del conductor (S3-CON-01 y S3-CON-02): solo ve y modifica los viajes que la administración le asignó.
export const rutasConductor = Router();

rutasConductor.use(requiereSesion, requiereRol('conductor'));

// #2905: datos de conductor y van asignada. El panel del conductor los lee de aquí en vez de copiarlos
// del navegador del administrador (la lista de vans es solo para administradores).
rutasConductor.get('/perfil', async (req, res) => {
  const { rows } = await pool.query<FilaConductor>(
    `SELECT ${COLUMNAS_CONDUCTOR}
       FROM conductores c
       JOIN usuarios u ON u.id = c.usuario_id
      WHERE c.usuario_id = $1`,
    [req.usuario!.id]
  );

  if (rows.length === 0) {
    res.status(404).json({
      error: 'Tu cuenta todavía no tiene datos de conductor. Pide a la administración que te registre.',
    });
    return;
  }

  // Un conductor maneja como máximo una van activa (vans_conductor_unique en 006_vans.sql).
  const van = await pool.query<FilaVan>(
    `SELECT ${COLUMNAS_VAN} FROM vans WHERE conductor_id = $1 AND activa ORDER BY id LIMIT 1`,
    [req.usuario!.id]
  );

  res.json({ conductor: aConductor(rows[0]), van: van.rows[0] ? aVan(van.rows[0]) : null });
});

// Lista todos los viajes asignados al conductor, incluidos los completados,
// con sus pasajeros y asientos.
rutasConductor.get('/viajes', async (req, res) => {
  const { rows } = await pool.query<FilaViaje>(
    `SELECT ${COLUMNAS_VIAJE}
       FROM viajes v
      WHERE v.conductor_id = $1
      ORDER BY v.fecha, v.hora, v.id`,
    [req.usuario!.id]
  );

  res.json({ viajes: await conReservas(rows) });
});

// Consulta el detalle de un viaje propio, con sus pasajeros y asientos.
rutasConductor.get('/viajes/:id', async (req, res) => {
  const id = idValido(req.params.id);

  if (id === null) {
    res.status(400).json({ error: 'El id del viaje no es válido.' });
    return;
  }

  const { rows } = await pool.query<FilaViaje>(
    `SELECT ${COLUMNAS_VIAJE}
       FROM viajes v
      WHERE v.id = $1 AND v.conductor_id = $2`,
    [id, req.usuario!.id]
  );

  if (rows.length === 0) {
    res.status(404).json({
      error: 'No encontramos este viaje entre los que tienes asignados.',
    });
    return;
  }

  const [viaje] = await conReservas(rows);
  res.json({ viaje });
});

// Cambia el estado de un viaje propio dentro de una transacción.
async function cambiarEstado(
  idViaje: number,
  conductorId: number,
  desde: 'pendiente' | 'en-curso',
  aplicar: (cliente: import('pg').PoolClient, viaje: { van_id: number | null }) => Promise<string | null>
): Promise<{ status: number; error: string } | null> {
  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');

    const { rows } = await cliente.query<{ estado: string; van_id: number | null }>(
      'SELECT estado, van_id FROM viajes WHERE id = $1 AND conductor_id = $2 FOR UPDATE',
      [idViaje, conductorId]
    );

    if (rows.length === 0) {
      await cliente.query('ROLLBACK');
      return {
        status: 404,
        error: 'No encontramos este viaje entre los que tienes asignados.',
      };
    }

    if (rows[0].estado !== desde) {
      await cliente.query('ROLLBACK');
      return {
        status: 409,
        error: desde === 'pendiente'
          ? 'Solo se puede iniciar un viaje pendiente.'
          : 'Solo se puede finalizar un viaje en curso.',
      };
    }

    const conflicto = await aplicar(cliente, rows[0]);

    if (conflicto) {
      await cliente.query('ROLLBACK');
      return { status: 409, error: conflicto };
    }

    await cliente.query('COMMIT');
    return null;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

// Inicia el viaje. Una van y un conductor hacen un viaje a la vez.
rutasConductor.post('/viajes/:id/iniciar', async (req, res) => {
  const id = idValido(req.params.id);

  if (id === null) {
    res.status(400).json({ error: 'El id del viaje no es válido.' });
    return;
  }

  const conductorId = req.usuario!.id;

  const fallo = await cambiarEstado(id, conductorId, 'pendiente', async (cliente, viaje) => {
    if (viaje.van_id === null) {
      return 'El viaje todavía no tiene una van asignada.';
    }

    const { rowCount } = await cliente.query(
      `SELECT 1
         FROM viajes
        WHERE id <> $1
          AND estado = 'en-curso'
          AND (conductor_id = $2 OR van_id = $3)`,
      [id, conductorId, viaje.van_id]
    );

    if (rowCount) {
      return 'Ya tienes un viaje en curso. Finalízalo antes de iniciar otro.';
    }

    await cliente.query(
      `UPDATE viajes
          SET estado = 'en-curso',
              iniciado_en = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [id]
    );

    // Registra la transición dentro de la misma transacción.
    await cliente.query(
      `INSERT INTO viajes_historial_estados
        (viaje_id, estado_anterior, estado_nuevo, usuario_id)
       VALUES ($1, 'pendiente', 'en-curso', $2)`,
      [id, conductorId]
    );

    return null;
  });

  if (fallo) {
    res.status(fallo.status).json({ error: fallo.error });
    return;
  }

  res.json({ viaje: await viajePorId(id) });
});

// Finaliza el viaje y completa sus reservas pendientes.
rutasConductor.post('/viajes/:id/finalizar', async (req, res) => {
  const id = idValido(req.params.id);

  if (id === null) {
    res.status(400).json({ error: 'El id del viaje no es válido.' });
    return;
  }

  const conductorId = req.usuario!.id;

  const fallo = await cambiarEstado(id, conductorId, 'en-curso', async (cliente) => {
    await cliente.query(
      `UPDATE viajes
          SET estado = 'completado',
              finalizado_en = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [id]
    );

    // Registra la transición dentro de la misma transacción.
    await cliente.query(
      `INSERT INTO viajes_historial_estados
        (viaje_id, estado_anterior, estado_nuevo, usuario_id)
       VALUES ($1, 'en-curso', 'completado', $2)`,
      [id, conductorId]
    );

    await cliente.query(
      `UPDATE reservas
          SET estado = 'completada'
        WHERE viaje_id = $1 AND estado = 'pendiente'`,
      [id]
    );

    return null;
  });

  if (fallo) {
    res.status(fallo.status).json({ error: fallo.error });
    return;
  }

  res.json({ viaje: await viajePorId(id) });
});

// GPS-05: ruta desde la posición del conductor hasta la sede de destino. El destino sale del viaje
// guardado en la base; el cliente solo envía su posición.
rutasConductor.get('/viajes/:id/ruta', async (req, res) => {
  const id = idValido(req.params.id);

  if (id === null) {
    res.status(400).json({ error: 'El id del viaje no es válido.' });
    return;
  }

  const latitud = Number(req.query.lat);
  const longitud = Number(req.query.lon);

  if (
    req.query.lat === undefined || req.query.lon === undefined ||
    !Number.isFinite(latitud) || !Number.isFinite(longitud) ||
    Math.abs(latitud) > 90 || Math.abs(longitud) > 180
  ) {
    res.status(400).json({ error: 'La posición enviada no es válida.' });
    return;
  }

  const { rows } = await pool.query<{ estado: string; destino: string }>(
    'SELECT estado, destino FROM viajes WHERE id = $1 AND conductor_id = $2',
    [id, req.usuario!.id]
  );

  if (rows.length === 0) {
    res.status(404).json({
      error: 'No encontramos este viaje entre los que tienes asignados.',
    });
    return;
  }

  if (rows[0].estado !== 'en-curso') {
    res.status(409).json({
      error: 'La navegación solo está disponible para un viaje en curso.',
    });
    return;
  }

  const destino = coordenadasDeSede(rows[0].destino);

  if (!destino) {
    res.status(409).json({
      error: 'El destino del viaje no tiene ubicación configurada.',
    });
    return;
  }

  try {
    res.json({
      ruta: await rutaHaciaDestino(id, { latitud, longitud }, destino),
    });
  } catch (error) {
    if (error instanceof ErrorRuta) {
      res.status(error.status).json({ error: error.message });
      return;
    }

    throw error;
  }
});
