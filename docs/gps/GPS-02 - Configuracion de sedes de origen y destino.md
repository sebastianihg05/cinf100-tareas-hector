## Objetivo

Dejar configuradas las ubicaciones de la ruta institucional utilizada en los viajes de ida y vuelta, para que la futura pantalla GPS obtenga automaticamente el destino del viaje asignado.

## Ruta vigente del sistema

La aplicacion tiene una sola ruta institucional:

- Ida: Quillota 980 (Campus Viña del Mar) hacia Santiago (Campus Bellavista).
- Vuelta: Santiago (Campus Bellavista) hacia Quillota 980 (Campus Viña del Mar).

Los nombres internos "Quillota 980" y "Santiago" provienen de frontend/src/admin/types.ts, en RUTA_TRAYECTO. Las sedes Quintay y Rokamar estan disponibles en el registro de usuarios, pero no forman parte de esta ruta.

## Direcciones y coordenadas de referencia

Campus Viña del Mar:
- Codigo interno: Quillota 980
- Direccion: Quillota 980, Viña del Mar, Region de Valparaiso, Chile.
- Latitud: -33.013281
- Longitud: -71.541247

Campus Bellavista:
- Codigo interno: Santiago
- Direccion: Bellavista 0121, Providencia, Region Metropolitana, Chile.
- Latitud: -33.435172
- Longitud: -70.634000

Las coordenadas se obtuvieron del informe Diagnostico Gestion de la Energia, Universidad Andres Bello, octubre de 2022. El informe entrega las coordenadas en grados, minutos y segundos. Se convirtieron a grados decimales y se redondearon a seis decimales.

Estas coordenadas identifican los campus como referencia geografica. No se ha confirmado si coinciden con los puntos exactos de estacionamiento, subida o bajada de la van. Esa confirmacion operativa debe realizarse antes de utilizar el GPS con pasajeros reales.

## Configuracion de la aplicacion

Archivo: frontend/src/gps/sedesGps.ts

- SEDES_GPS contiene los nombres, direcciones y coordenadas de ambos campus en un solo lugar.
- resolverRutaGps(viaje) determina el origen y el destino utilizando el trayecto y la ruta institucional existentes.
- Para Ida el destino es Campus Bellavista; para Vuelta es Campus Viña del Mar.
- No existe un parametro para que el conductor introduzca manualmente otro destino.
- Si el viaje tiene un trayecto desconocido, una ruta diferente o faltan coordenadas, se devuelve un mensaje de error sin inventar un destino.
- coordenadasParaRutas(sede) devuelve [longitud, latitud], el orden que espera openrouteservice.

El modulo no dibuja mapas ni consulta todavia servicios GPS. Lo utilizaran las tareas de implementacion #2338 a #2342.

## Pruebas previstas

Archivo: frontend/src/gps/sedesGps.test.ts

Se comprueban la ida, la vuelta, el rechazo de destinos no configurados, los trayectos desconocidos y el formato de las coordenadas.

## Validaciones pendientes antes del uso real

- Confirmar con el equipo UNAB el punto fisico donde se detiene la van en cada campus.
- Probar que el proveedor de rutas pueda ubicar el punto en una calle transitable y no dentro del edificio.
- Confirmar el recorrido con un conductor antes de poner el GPS en produccion.

## Fuentes

- Codigo actual: frontend/src/admin/types.ts y frontend/src/pasajero/viajes.ts (version desa(7)).
- Informe UNAB, paginas impresas 4 y 6: https://sostenibilidad.unab.cl/wp-content/uploads/2023/05/Diagnostico-Energetico-UNAB.pdf
- Campus Viña del Mar: https://infraestructura.unab.cl/campus-unab/campus-vina-del-mar/
- Campus Bellavista: https://infraestructura.unab.cl/campus-unab/campus-bellavista/
