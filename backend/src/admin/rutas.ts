import { Router, type Response } from 'express';
import { requiereRol, requiereSesion } from '../auth/middleware';
import { pool } from '../db';
import { aPerfil, COLUMNAS_PERFIL, type Rol } from '../usuarios/perfil';

// Rutas solo para administradores (BD-14).
export const rutasAdmin = Router();

rutasAdmin.use(requiereSesion, requiereRol('administrador'));

// Roles que un administrador puede asignar al aprobar. 'administrador' no se
// entrega desde la API: así nadie puede crear administradores por error.
const ROLES_ASIGNABLES: Rol[] = ['funcionario', 'conductor'];

// BD-15: solicitudes de registro pendientes, de la más antigua a la más nueva.
rutasAdmin.get('/solicitudes', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_PERFIL} FROM usuarios
      WHERE estado_aprobacion = 'pendiente'
      ORDER BY creado_en`
  );
  res.json({ solicitudes: rows.map(aPerfil) });
});

// Todos los usuarios, para los listados del panel de administración.
rutasAdmin.get('/usuarios', async (_req, res) => {
  const { rows } = await pool.query(`SELECT ${COLUMNAS_PERFIL} FROM usuarios ORDER BY id`);
  res.json({ usuarios: rows.map(aPerfil) });
});

function idDeRuta(valor: string, res: Response): number | null {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'El id de la solicitud no es válido.' });
    return null;
  }
  return id;
}

// Responde 404 si la solicitud no existe, o 409 si ya no está pendiente.
async function solicitudNoDisponible(id: number, res: Response) {
  const { rowCount } = await pool.query('SELECT 1 FROM usuarios WHERE id = $1', [id]);
  if (rowCount === 0) {
    res.status(404).json({ error: 'La solicitud no existe.' });
  } else {
    res.status(409).json({ error: 'La solicitud ya fue aprobada o rechazada.' });
  }
}

// BD-16: aprobar una solicitud y asignarle un rol.
rutasAdmin.post('/solicitudes/:id/aprobar', async (req, res) => {
  const id = idDeRuta(req.params.id, res);
  if (id === null) return;

  const rol = req.body?.rol;
  if (!ROLES_ASIGNABLES.includes(rol)) {
    res.status(400).json({ errores: { rol: `El rol debe ser uno de: ${ROLES_ASIGNABLES.join(', ')}.` } });
    return;
  }

  const { rows } = await pool.query(
    `UPDATE usuarios
        SET estado_aprobacion = 'aprobada', rol = $2,
            decidido_por = $3, decidido_en = CURRENT_TIMESTAMP
      WHERE id = $1 AND estado_aprobacion = 'pendiente'
      RETURNING ${COLUMNAS_PERFIL}`,
    [id, rol, req.usuario!.id]
  );
  if (rows.length === 0) {
    await solicitudNoDisponible(id, res);
    return;
  }
  res.json({ usuario: aPerfil(rows[0]) });
});

// BD-16: rechazar una solicitud. La cuenta queda guardada como 'rechazada'.
rutasAdmin.post('/solicitudes/:id/rechazar', async (req, res) => {
  const id = idDeRuta(req.params.id, res);
  if (id === null) return;

  const { rows } = await pool.query(
    `UPDATE usuarios
        SET estado_aprobacion = 'rechazada',
            decidido_por = $2, decidido_en = CURRENT_TIMESTAMP
      WHERE id = $1 AND estado_aprobacion = 'pendiente'
      RETURNING ${COLUMNAS_PERFIL}`,
    [id, req.usuario!.id]
  );
  if (rows.length === 0) {
    await solicitudNoDisponible(id, res);
    return;
  }
  res.json({ usuario: aPerfil(rows[0]) });
});