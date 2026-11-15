# Pruebas del GPS (GPS-08)

Pantalla: `/conductor/viajes/:viajeId/navegacion`. Solo se habilita para un viaje propio **En curso**.

## Pruebas automáticas

| Archivo | Qué comprueba |
| --- | --- |
| `frontend/src/gps/geo.test.ts` | Distancias, avance sobre la ruta, tiempo restante y formatos |
| `frontend/src/gps/sedesGps.test.ts` | Destino según Ida o Vuelta; rechazo de trayectos no válidos |
| `frontend/src/gps/seguimiento.test.tsx` | Permiso, señal perdida, `clearWatch` al salir; una sola consulta de ruta, recálculo por desvío con intervalos mínimos, error del proveedor |
| `frontend/src/gps/navegacion.test.tsx` | Pantalla completa con GPS simulado: Ida/Vuelta, ruta e indicadores, sin señal, permiso denegado, finalizar viaje, volver, historial, acceso con viaje no En curso |
| `backend/tests/viajes.test.ts` | Ruta solo para el conductor del viaje En curso, destino decidido por el servidor, límites de consulta |

Ejecución: `cd frontend && npm test` y `cd backend && npm test`.

## Pruebas manuales en dispositivo (no automatizables)

Requisitos: HTTPS o `localhost`, `ORS_API_KEY` configurada en el backend, un viaje asignado al conductor.

1. Iniciar el viaje y pulsar **Abrir navegación**. Aceptar el permiso: el punto azul aparece y el estado indica "GPS activo".
2. Verificar que la ruta se dibuja hasta la sede correcta (Ida → Santiago; Vuelta → Quillota 980).
3. Moverse (o simular ubicación en las herramientas del navegador): la distancia y el tiempo restantes disminuyen sin nuevas consultas de ruta.
4. Desviarse más de 200 m durante al menos dos lecturas: la ruta se recalcula una vez; no más de una vez cada 30 s.
5. Rechazar el permiso o desactivar la ubicación: se muestra el mensaje y **Reintentar ubicación** funciona.
6. Activar modo avión unos segundos: tras ~30 s aparece "Sin señal GPS"; al volver la señal se recupera sola.
7. Mover el mapa con el dedo: aparece **Centrar en mi posición**.
8. **Finalizar viaje**: se confirma, el seguimiento se detiene (el indicador de ubicación del navegador desaparece) y el viaje queda Completado en el historial.
9. Revisar en pantalla de 360 px de ancho: botones de al menos 48 px, mapa visible sin desplazar.
