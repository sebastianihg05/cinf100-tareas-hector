Objetivo
Definir cómo se enviarán los correos de confirmación cuando un funcionario realice una reserva de transporte.
Destinatarios
- Funcionario: recibe un correo de confirmación de su reserva.
- Administradores: cada usuario con rol de administrador, cuenta aprobada y activa recibe un correo informando de la nueva reserva.
Los destinatarios se obtienen desde las cuentas registradas en PostgreSQL. No se utilizará una lista fija de correos administrativos.
Información de los correos
Correo al funcionario:
- Identificador de la reserva, si está disponible.
- Nombre del funcionario.
- Fecha del viaje.
- Horario.
- Origen y destino.
- Trayecto: ida, vuelta o ida y vuelta.
- Número de asiento de cada trayecto.
Correo a cada administrador:
- Identificador de la reserva, si está disponible.
- Nombre y correo institucional del funcionario.
- Fecha del viaje.
- Horario.
- Origen y destino.
- Trayecto: ida, vuelta o ida y vuelta.
- Número de asiento de cada trayecto.
No se incluirán contraseñas, tokens ni otros datos sensibles innecesarios.
Flujo de funcionamiento
1. El funcionario selecciona el viaje y los asientos y confirma la reserva.
2. El backend valida los datos y la disponibilidad de los asientos.
3. La reserva se guarda en PostgreSQL.
4. Solo cuando el guardado termina correctamente se generan las notificaciones.
5. Se envía un correo al funcionario y uno a cada administrador activo y aprobado.
6. Si se trata de una reserva de ida y vuelta, cada destinatario recibe un solo correo con ambos trayectos.
Reglas y casos de error
- Si la reserva falla o es rechazada, no se envían correos de confirmación.
- Si falla el envío de un correo, la reserva ya confirmada se mantiene.
- Si falla el envío a un administrador, no se impide enviar los correos a los demás destinatarios.
- Los errores de envío deben registrarse para su revisión.
- Los reintentos no deben provocar correos duplicados: cada destinatario debe recibir como máximo una confirmación por reserva confirmada.
- Si se agrega un administrador nuevo, recibirá notificaciones una vez que su cuenta esté aprobada y activa.
- Los administradores pendientes, rechazados o desactivados no recibirán correos.
Cancelaciones y cambios de asiento
- Los correos de cancelación se coordinarán con la tarea #835, que ya contempla esta funcionalidad.
- La cancelación no debe generar un nuevo correo de confirmación.
- Las notificaciones por cambio de asiento quedan fuera de este primer flujo y se definirán si el equipo las necesita.
Relación con otras tareas
- #2317: implementar el servicio de envío de correos en el backend.
- #2318: conectar los correos con la confirmación real de reservas.
- #2319: probar los envíos, los errores y los casos de duplicación.
- #2606: implementar la creación de reservas en PostgreSQL; el correo se genera únicamente después de una reserva exitosa.
- #835: envío de correos al cancelar una reserva.
Criterios de finalización
- Están definidos los destinatarios de las notificaciones.
- Está definido el contenido de los correos.
- Los correos se generan solo después de confirmar la reserva en PostgreSQL.
- Se contempla el caso de ida y vuelta en un único mensaje por destinatario.
- Está documentado qué ocurre ante una reserva fallida o un error de correo.
- Está definido que no deben enviarse notificaciones duplicadas.
- El documento puede utilizarse como referencia para las tareas #2317 y #2318.
