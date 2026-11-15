
import { Router, type RequestHandler } from 'express';
import { requiereSesion, requiereRol } from '../auth/middleware';
import { cambiarAsientos, cancelarReserva } from './cambios';
import { crearReservas, ErrorReserva } from './servicio';

export const rutasReservas = Router();

rutasReservas.post(
  '/',
  requiereSesion,
  requiereRol('funcionario'),
  async (req, res, next) => {
    try {
      const { solicitudes } = req.body ?? {};

      if (!Array.isArray(solicitudes)) {
        res.status(400).json({
          error: 'Debes proporcionar una lista de reservas.',
        });
        return;
      }

      const resultado = await crearReservas(
        {
          id: req.usuario!.id,
          nombreCompleto: req.usuario!.nombreCompleto,
          correo: req.usuario!.correo,
        },
        solicitudes
      );

      res.status(201).json(resultado);
    } catch (error) {
      if (error instanceof ErrorReserva) {
        res.status(error.codigo).json({ error: error.message });
        return;
      }

      next(error);
    }
  }
);

// Responde los errores esperados de reservas con su código; los demás van al manejador general.
const conErroresDeReserva = (accion: RequestHandler): RequestHandler => async (req, res, next) => {
  try {
    await accion(req, res, next);
  } catch (error) {
    if (error instanceof ErrorReserva) {
      res.status(error.codigo).json({ error: error.message });
      return;
    }
    next(error);
  }
};

// S3-RES-03 (#2607): cancelar toda la reserva o solo algunos trayectos (body opcional { reservaIds }).
rutasReservas.post(
  '/:grupoId/cancelar',
  requiereSesion,
  requiereRol('funcionario'),
  conErroresDeReserva(async (req, res) => {
    res.json(await cancelarReserva(req.usuario!.id, String(req.params.grupoId), req.body?.reservaIds));
  })
);

// S3-RES-03 (#2607): cambiar el asiento de uno o ambos trayectos ({ cambios: [{ reservaId, asiento }] }).
rutasReservas.patch(
  '/:grupoId/asientos',
  requiereSesion,
  requiereRol('funcionario'),
  conErroresDeReserva(async (req, res) => {
    res.json(await cambiarAsientos(req.usuario!.id, String(req.params.grupoId), req.body?.cambios));
  })
);
