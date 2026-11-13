
import nodemailer from 'nodemailer';
import type { SendMailOptions } from 'nodemailer';

// Datos que necesita un correo para ser enviado.
export interface Correo {
  para: string | string[];
  asunto: string;
  texto: string;
  html?: string;
}

// Permite utilizar un transporte propio, por ejemplo, en las pruebas.
export interface TransporteCorreo {
  sendMail(opciones: SendMailOptions): Promise<unknown>;
}

interface ConfiguracionSMTP {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

// Obtiene y valida las credenciales desde las variables de entorno.
function obtenerConfiguracionSMTP(): ConfiguracionSMTP {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASSWORD,
    EMAIL_FROM,
  } = process.env;

  const faltantes = [
    ['SMTP_HOST', SMTP_HOST],
    ['SMTP_PORT', SMTP_PORT],
    ['SMTP_USER', SMTP_USER],
    ['SMTP_PASSWORD', SMTP_PASSWORD],
    ['EMAIL_FROM', EMAIL_FROM],
  ]
    .filter(([, valor]) => !valor)
    .map(([nombre]) => nombre);

  if (faltantes.length > 0) {
    throw new Error(
      `Faltan variables de configuración SMTP: ${faltantes.join(', ')}`
    );
  }

  const port = Number(SMTP_PORT);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT debe ser un puerto válido.');
  }

  if (SMTP_SECURE && !['true', 'false'].includes(SMTP_SECURE)) {
    throw new Error('SMTP_SECURE debe ser true o false.');
  }

  return {
    host: SMTP_HOST!,
    port,
    secure: SMTP_SECURE === 'true',
    user: SMTP_USER!,
    password: SMTP_PASSWORD!,
    from: EMAIL_FROM!,
  };
}

// Permite configurar el transporte sin repetir la lógica de envío.
export function crearServicioCorreo(opciones?: {
  transporte?: TransporteCorreo;
  remitente?: string;
}) {
  let transporte = opciones?.transporte;
  let remitente = opciones?.remitente;

  function obtenerTransporte(): TransporteCorreo {
    if (transporte) {
      return transporte;
    }

    const config = obtenerConfiguracionSMTP();

    transporte = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });

    remitente = config.from;

    return transporte;
  }

  // Envía un correo utilizando la configuración establecida.
  async function enviarCorreo(correo: Correo): Promise<void> {
    try {
      if (!correo.para || !correo.asunto || !correo.texto) {
        throw new Error(
          'El destinatario, asunto y texto del correo son obligatorios.'
        );
      }

      const conexion = obtenerTransporte();

      if (!remitente) {
        throw new Error('No se ha configurado el remitente EMAIL_FROM.');
      }

      await conexion.sendMail({
        from: remitente,
        to: correo.para,
        subject: correo.asunto,
        text: correo.texto,
        html: correo.html,
      });

      console.info('[Servicio de correo] Correo enviado correctamente.', {
        destinatarios: correo.para,
        asunto: correo.asunto,
      });
    } catch (error) {
      console.error('[Servicio de correo] Error al enviar el correo:', error);
      throw error;
    }
  }

  return { enviarCorreo };
}

// Instancia reutilizable para el resto del backend.
export const servicioCorreo = crearServicioCorreo();
