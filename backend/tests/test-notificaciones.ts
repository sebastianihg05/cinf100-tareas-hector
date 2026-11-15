

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  crearServicioCorreo,
  type TransporteCorreo,
} from '../src/notificaciones/servicio-correo';

import {
  crearPlantillaHTML,
  crearPlantillaTexto,
} from '../src/notificaciones/plantillas-correo';

describe('Servicio de correo', () => {
  it('debe enviar un correo correctamente y verificar sus datos', async () => {
    let correoEnviado: any;

    const transporte: TransporteCorreo = {
      async sendMail(opciones) {
        correoEnviado = opciones;
        return {};
      },
    };

    const servicio = crearServicioCorreo({
      transporte,
      remitente: 'pruebas@unab.cl',
    });

    await servicio.enviarCorreo({
      para: 'destinatario@unab.cl',
      asunto: 'Prueba',
      texto: 'Correo de prueba',
      html: '<p>Correo de prueba</p>',
    });

    assert.equal(correoEnviado.to, 'destinatario@unab.cl');
    assert.equal(correoEnviado.subject, 'Prueba');
    assert.equal(correoEnviado.from, 'pruebas@unab.cl');
    assert.equal(correoEnviado.text, 'Correo de prueba');
    assert.equal(correoEnviado.html, '<p>Correo de prueba</p>');
  });

  it('debe aceptar varios destinatarios', async () => {
    let destinatarios: string | string[] | undefined;

    const transporte: TransporteCorreo = {
      async sendMail(opciones) {
        destinatarios = opciones.to;
        return {};
      },
    };

    const servicio = crearServicioCorreo({
      transporte,
      remitente: 'pruebas@unab.cl',
    });

    await servicio.enviarCorreo({
      para: ['persona1@unab.cl', 'persona2@unab.cl'],
      asunto: 'Prueba múltiple',
      texto: 'Notificación',
    });

    assert.deepEqual(destinatarios, [
      'persona1@unab.cl',
      'persona2@unab.cl',
    ]);
  });

  it('debe rechazar un correo sin destinatario', async () => {
    let intentosEnvio = 0;

    const transporte: TransporteCorreo = {
      async sendMail() {
        intentosEnvio++;
        return {};
      },
    };

    const servicio = crearServicioCorreo({
      transporte,
      remitente: 'pruebas@unab.cl',
    });

    await assert.rejects(
      servicio.enviarCorreo({
        para: '',
        asunto: 'Prueba',
        texto: 'Contenido',
      }),
      /obligatorios/
    );

    assert.equal(intentosEnvio, 0);
  });

  it('debe rechazar un correo sin asunto', async () => {
    let intentosEnvio = 0;

    const transporte: TransporteCorreo = {
      async sendMail() {
        intentosEnvio++;
        return {};
      },
    };

    const servicio = crearServicioCorreo({
      transporte,
      remitente: 'pruebas@unab.cl',
    });

    await assert.rejects(
      servicio.enviarCorreo({
        para: 'destinatario@unab.cl',
        asunto: '',
        texto: 'Contenido',
      }),
      /obligatorios/
    );

    assert.equal(intentosEnvio, 0);
  });

  it('debe rechazar un correo sin texto', async () => {
    let intentosEnvio = 0;

    const transporte: TransporteCorreo = {
      async sendMail() {
        intentosEnvio++;
        return {};
      },
    };

    const servicio = crearServicioCorreo({
      transporte,
      remitente: 'pruebas@unab.cl',
    });

    await assert.rejects(
      servicio.enviarCorreo({
        para: 'destinatario@unab.cl',
        asunto: 'Prueba',
        texto: '',
      }),
      /obligatorios/
    );

    assert.equal(intentosEnvio, 0);
  });

  it('debe propagar los errores del transporte', async () => {
    const transporte: TransporteCorreo = {
      async sendMail() {
        throw new Error('Error SMTP de prueba');
      },
    };

    const servicio = crearServicioCorreo({
      transporte,
      remitente: 'pruebas@unab.cl',
    });

    await assert.rejects(
      servicio.enviarCorreo({
        para: 'destinatario@unab.cl',
        asunto: 'Prueba de error',
        texto: 'Notificación',
      }),
      /Error SMTP de prueba/
    );
  });
});

describe('Plantillas de correo', () => {
  it('debe generar una plantilla HTML con los datos recibidos', () => {
    const html = crearPlantillaHTML({
      titulo: 'Reserva confirmada',
      mensaje: 'La reserva fue registrada.',
      detalles: [
        { etiqueta: 'Viaje', valor: 'VAN-01' },
      ],
    });

    assert.match(html, /Reserva confirmada/);
    assert.match(html, /La reserva fue registrada/);
    assert.match(html, /Viaje/);
    assert.match(html, /VAN-01/);
  });

  it('debe escapar contenido HTML', () => {
    const html = crearPlantillaHTML({
      titulo: '<script>alert("prueba")</script>',
      mensaje: 'Notificación',
    });

    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
  });

  it('debe generar una plantilla de texto plano', () => {
    const texto = crearPlantillaTexto({
      titulo: 'Reserva confirmada',
      mensaje: 'La reserva fue registrada.',
      detalles: [
        { etiqueta: 'Viaje', valor: 'VAN-01' },
      ],
    });

    assert.match(texto, /Reserva confirmada/);
    assert.match(texto, /La reserva fue registrada/);
    assert.match(texto, /Viaje: VAN-01/);
  });
});
