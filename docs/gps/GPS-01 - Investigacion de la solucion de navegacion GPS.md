Objetivo
Seleccionar una solucion sencilla para mostrar al conductor su posicion, la ruta hacia la sede de destino y la distancia y tiempo estimados del viaje en curso.
Tecnologias recomendadas
- React Leaflet 5 y Leaflet: mostrar el mapa, marcadores y la linea de la ruta en el frontend React 19 y TypeScript.
- Geolocalizacion del navegador: obtener y actualizar la posicion del dispositivo con navigator.geolocation.watchPosition().
- openrouteservice: calcular rutas por carretera, kilometros y duracion estimada. Usar el endpoint vigente de HeiGIT: https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson
- PostgreSQL y backend existente: consultar el viaje autenticado y su destino; el frontend no debe decidir libremente destinos ajenos al viaje.
Flujo de funcionamiento
1. El conductor accede a un viaje que tiene asignado y lo inicia.
2. El sistema obtiene automaticamente el destino segun el trayecto del viaje.
3. El navegador solicita permiso para utilizar la ubicacion del dispositivo.
4. Se muestra el mapa, la posicion actual y la ruta de conduccion hacia el destino.
5. Se presentan los kilometros restantes y el tiempo estimado que devuelve el servicio de rutas.
6. La posicion se actualiza mientras el viaje esta activo. La ruta solo se recalcula cuando sea necesario, por ejemplo si el conductor se desvia, evitando llamadas en cada actualizacion GPS.
7. Al completar el viaje se detiene el seguimiento de posicion.
Limites del alcance
- No incluye instrucciones por voz ni navegacion avanzada giro a giro.
- No incluye compartir la posicion con el administrador ni guardar un historial continuo de coordenadas.
- No debe seguir consultando la ubicacion una vez finalizado el viaje.
- Si el conductor rechaza el permiso de ubicacion, se informara claramente y el resto del panel seguira funcionando.
- Si falla el servicio de rutas, se informara el error sin bloquear las funciones de inicio o fin del viaje.
Requisitos tecnicos
- La geolocalizacion del navegador necesita permiso explicito del conductor y un contexto seguro HTTPS o localhost para desarrollo.
- La clave de openrouteservice debe almacenarse en variables de entorno del backend y no publicarse en el codigo del frontend.
- Hay que comprobar limites, condiciones de uso y disponibilidad del proveedor de rutas y del proveedor de teselas de mapa.
- Si se usan las teselas publicas de OpenStreetMap, se deben respetar sus condiciones de uso y mostrar la atribucion correspondiente.
- Las direcciones exactas o coordenadas de origen y destino deben ser validadas por la universidad en la tarea #2337; no se fijan en este documento.
- El tiempo estimado es orientativo y no equivale necesariamente a un pronostico de trafico en tiempo real.
Prueba de concepto pendiente
1. Mostrar un mapa en un componente React 19 utilizando React Leaflet 5.
2. Solicitar permiso de ubicacion y mostrar un marcador de prueba.
3. Solicitar una ruta de prueba mediante el backend a openrouteservice.
4. Mostrar geometria, kilometros y tiempo estimado de la ruta.
5. Comprobar los estados sin permiso, sin conexion y con error del proveedor.
Conclusion
Se recomienda React Leaflet 5 + Geolocalizacion del navegador + openrouteservice a traves del backend existente. Es una solucion acorde con el alcance de GPS sencillo solicitado. La decision definitiva se valida cuando la prueba de concepto funcione en el proyecto.
Tareas relacionadas
- #2337: configurar sedes y coordenadas definitivas.
- #2338 a #2341: interfaz, ubicacion, ruta y progreso.
- #2342: integrar el GPS con el ciclo de vida del viaje.
- #2343: pruebas del GPS.
Fuentes consultadas
- React Leaflet: https://react-leaflet.js.org/docs/start-introduction/
- Compatibilidad de React Leaflet 5 con React 19: https://github.com/PaulLeCam/react-leaflet/blob/master/CHANGELOG.md
- Geolocalizacion del navegador: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition
- API de rutas: https://github.com/GIScience/openrouteservice/blob/main/docs/api-reference/endpoints/directions/requests-and-return-types.md
- Cambio de dominio de la API: https://heigit.org/changes-in-the-openrouteservice-universe/
- Politica de teselas OpenStreetMap: https://operations.osmfoundation.org/policies/tiles/
