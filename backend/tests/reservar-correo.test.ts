

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import {
  crearServicioReservas,
  ErrorReserva,
} from '../src/reservas/servicio';

const usuario = {
  id: 1,
  nombreCompleto: 'Juan Pérez',
  correo: 'juan@unab.cl',
};

const viaje = {
  id: 10,
  fecha: '2026-11-20',
  hora: '10:00',
  trayecto: 'Ida',
  origen: 'Viña del Mar',
  destino: 'Santiago',
  estado: 'pendiente',
  capacidad: 8,
  activa: true,
  dias: 7,
};

function crearBaseDatosSimulada(opciones?: {
  viajeRechazado?: boolean;
}) {
  const consultas: string[] = [];

  const cliente = {
    async query(sql: string) {
      consultas.push(sql);

      if (sql.includes('gen_random_uuid')) {
        return { rows: [{ id: 'grupo-prueba' }] };
      }

      if (sql.includes('FROM viajes')) {
        return {
          rows: opciones?.viajeRechazado
            ? [{ ...viaje, estado: 'cancelado' }]
            : [viaje],
        };
      }

      if (sql.includes('INSERT INTO reservas')) {
        return { rows: [{ id: 100 }] };
      }

      return { rows: [] };
    },
    release() {},
  };

  return {
    consultas,
    connect: async () => cliente as unknown as PoolClient,
  };
}

describe('Integración de reservas y correo', () => {
  it('envía la confirmación al destinatario correcto con los datos de la reserva', async () => {
    const baseDatos = crearBaseDatosSimulada();
    let correoEnviado: any;

    const crearReservas = crearServicioReservas({
      baseDatos,
      enviarCorreo: async (correo) => {
        correoEnviado = correo;
      },
    });

    const resultado = await crearReservas(usuario, [
      { viajeId: 10, asiento: 3 },
    ]);

    assert.equal(resultado.reservas.length, 1);
    assert.equal(correoEnviado.para, usuario.correo);
    assert.match(correoEnviado.asunto, /Confirmación de reserva/);
    assert.match(correoEnviado.texto, /Juan Pérez/);
    assert.match(correoEnviado.texto, /Viña del Mar/);
    assert.match(correoEnviado.texto, /Santiago/);
    assert.match(correoEnviado.texto, /3/);
  });

  it('no envía correo cuando la reserva es rechazada', async () => {
    const baseDatos = crearBaseDatosSimulada({
      viajeRechazado: true,
    });

    let intentosEnvio = 0;

    const crearReservas = crearServicioReservas({
      baseDatos,
      enviarCorreo: async () => {
        intentosEnvio++;
      },
    });

    await assert.rejects(
      crearReservas(usuario, [{ viajeId: 10, asiento: 3 }]),
      ErrorReserva
    );

    assert.equal(intentosEnvio, 0);
    assert.ok(baseDatos.consultas.includes('ROLLBACK'));
    assert.ok(!baseDatos.consultas.includes('COMMIT'));
  });

  it('mantiene la reserva confirmada aunque falle el envío del correo', async () => {
    const baseDatos = crearBaseDatosSimulada();
    let intentosEnvio = 0;

    const crearReservas = crearServicioReservas({
      baseDatos,
      enviarCorreo: async () => {
        intentosEnvio++;
        throw new Error('Error SMTP simulado');
      },
    });

    const resultado = await crearReservas(usuario, [
      { viajeId: 10, asiento: 3 },
    ]);

    assert.equal(resultado.reservas.length, 1);
    assert.equal(resultado.reservas[0].id, 100);
    assert.ok(baseDatos.consultas.includes('COMMIT'));
    assert.ok(!baseDatos.consultas.includes('ROLLBACK'));
    assert.equal(intentosEnvio, 1);
  });

  it('no envía correo cuando la base de datos rechaza una reserva duplicada', async () => {
    const consultas: string[] = [];
    let intentosEnvio = 0;

    const cliente = {
      async query(sql: string) {
        consultas.push(sql);

        if (sql.includes('gen_random_uuid')) {
          return { rows: [{ id: 'grupo-prueba' }] };
        }

        if (sql.includes('FROM viajes')) {
          return { rows: [viaje] };
        }

        if (sql.includes('INSERT INTO reservas')) {
          throw Object.assign(
            new Error('Reserva duplicada'),
            { code: '23505' }
          );
        }

        return { rows: [] };
      },
      release() {},
    };

    const crearReservas = crearServicioReservas({
      baseDatos: {
        connect: async () => cliente as unknown as PoolClient,
      },
      enviarCorreo: async () => {
        intentosEnvio++;
      },
    });

    await assert.rejects(
      crearReservas(usuario, [{ viajeId: 10, asiento: 3 }]),
      ErrorReserva
    );

    assert.equal(intentosEnvio, 0);
    assert.ok(consultas.includes('ROLLBACK'));
    assert.ok(!consultas.includes('COMMIT'));
  });
});
