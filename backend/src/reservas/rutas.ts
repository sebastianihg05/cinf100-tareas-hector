
import { Router } from 'express';
import { requiereSesion, requiereRol } from '../auth/middleware';
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
