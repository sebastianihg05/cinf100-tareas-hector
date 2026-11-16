import { Router } from 'express';
import { requiereSesion } from '../auth/middleware';
import { pool } from '../db';

// S3-RES-04 (#2608): avisos de la campana que la persona ya leyó, guardados en la tabla avisos_leidos.
// Sirve para cualquier rol: cada uno solo ve y marca los suyos.
export const rutasAvisos = Router();

rutasAvisos.use(requiereSesion);

// Mismo formato que el CHECK de 007_avisos_leidos.sql, por ejemplo "confirmada:<uuid>" o "cancelado:42".
const ID_AVISO = /^[a-z-]+:[0-9a-f-]+$/;
const MAXIMO_POR_SOLICITUD = 50;

async function leidosDe(usuarioId: number): Promise<string[]> {
  const { rows } = await pool.query<{ aviso_id: string }>(
    'SELECT aviso_id FROM avisos_leidos WHERE usuario_id = $1 ORDER BY leido_en, aviso_id',
    [usuarioId]
  );
  return rows.map((fila) => fila.aviso_id);
}

rutasAvisos.get('/leidos', async (req, res) => {
  res.json({ leidos: await leidosDe(req.usuario!.id) });
});

// Marca como leídos los avisos indicados ({ ids: [...] }). Repetir uno ya leído no hace nada.
rutasAvisos.post('/leidos', async (req, res) => {
  const ids: unknown = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAXIMO_POR_SOLICITUD
    || !ids.every((id) => typeof id === 'string' && id.length <= 80 && ID_AVISO.test(id))) {
    res.status(400).json({ error: `Indica de 1 a ${MAXIMO_POR_SOLICITUD} avisos con un id válido.` });
    return;
  }

  await pool.query(
    `INSERT INTO avisos_leidos (usuario_id, aviso_id)
     SELECT $1, UNNEST($2::varchar[])
     ON CONFLICT DO NOTHING`,
    [req.usuario!.id, [...new Set(ids)]]
  );
  res.json({ leidos: await leidosDe(req.usuario!.id) });
});
