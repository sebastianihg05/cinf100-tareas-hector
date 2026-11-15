import { describe, expect, it } from 'vitest'
import { coordenadasParaRutas, resolverRutaGps, SEDES_GPS } from './sedesGps'

/** GPS-02 y GPS-08: el destino lo decide el trayecto del viaje, nunca el conductor. */
describe('resolverRutaGps', () => {
  it('la ida va de Quillota 980 a Santiago', () => {
    const r = resolverRutaGps({ trayecto: 'Ida', origen: 'Quillota 980', destino: 'Santiago' })
    expect(r).toMatchObject({ ok: true })
    if (r.ok) {
      expect(r.origen.codigo).toBe('Quillota 980')
      expect(r.destino.codigo).toBe('Santiago')
    }
  })

  it('la vuelta va de Santiago a Quillota 980', () => {
    const r = resolverRutaGps({ trayecto: 'Vuelta', origen: 'Santiago', destino: 'Quillota 980' })
    expect(r.ok && r.destino.codigo).toBe('Quillota 980')
  })

  it('rechaza un trayecto inválido o una ruta que no es la institucional', () => {
    expect(resolverRutaGps({ trayecto: 'Otro' as never, origen: 'Santiago', destino: 'Quillota 980' }).ok).toBe(false)
    expect(resolverRutaGps({ trayecto: 'Ida', origen: 'Santiago', destino: 'Quillota 980' }).ok).toBe(false)
  })

  it('las coordenadas para el servicio de rutas van en orden [longitud, latitud]', () => {
    expect(coordenadasParaRutas(SEDES_GPS.Santiago)).toEqual([-70.634, -33.435172])
  })
})
