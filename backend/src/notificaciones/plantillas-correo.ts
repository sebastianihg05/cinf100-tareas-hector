
export interface DatosPlantilla {
  titulo: string;
  mensaje: string;
  detalles?: {
    etiqueta: string;
    valor: string;
  }[];
}

// Genera una plantilla HTML reutilizable para las notificaciones.
export function crearPlantillaHTML(datos: DatosPlantilla): string {
  const detallesHTML = (datos.detalles ?? [])
    .map(
      (detalle) => `
        <tr>
          <td style="padding: 8px; font-weight: bold;">
            ${escaparHTML(detalle.etiqueta)}
          </td>
          <td style="padding: 8px;">
            ${escaparHTML(detalle.valor)}
          </td>
        </tr>
      `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>${escaparHTML(datos.titulo)}</title>
      </head>
      <body style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 600px; margin: auto; padding: 20px;">
          <h2>${escaparHTML(datos.titulo)}</h2>

          <p>${escaparHTML(datos.mensaje)}</p>

          ${
            detallesHTML
              ? `
                <table style="width: 100%; border-collapse: collapse;">
                  ${detallesHTML}
                </table>
              `
              : ''
          }

          <hr>
          <p style="font-size: 12px; color: #777;">
            Sistema de Gestión de Transportes Vans UNAB
          </p>
        </div>
      </body>
    </html>
  `;
}

// Evita que los datos ingresados se interpreten como código HTML.
function escaparHTML(valor: string): string {
  return valor.replace(/[&<>"']/g, (caracter) => {
    const entidades: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entidades[caracter];
  });
}

// Genera el contenido de texto plano de la misma notificación.
export function crearPlantillaTexto(datos: DatosPlantilla): string {
  const detalles = (datos.detalles ?? [])
    .map((detalle) => `${detalle.etiqueta}: ${detalle.valor}`)
    .join('\n');

  return [
    datos.titulo,
    '',
    datos.mensaje,
    detalles ? `\n${detalles}` : '',
    '',
    'Sistema de Gestión de Transportes Vans UNAB',
  ].join('\n');
}
