
import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { instalarApiFalsa } from './apiFalsa'

// En las pruebas se simula ScrollTrigger para evitar temporizadores
// que continúan ejecutándose después de cerrar jsdom.
vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    name: 'ScrollTrigger',
    register() {},
    create() {
      return {
        kill() {},
        refresh() {},
        disable() {},
        enable() {},
      }
    },
    refresh() {},
    update() {},
    killAll() {},
    getAll() {
      return []
    },
    addEventListener() {},
    removeEventListener() {},
  },
}))

// Ninguna prueba llama al backend real: fetch responde con un backend falso en memoria.
beforeEach(() => {
  instalarApiFalsa()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

// jsdom no trae matchMedia y gsap (React Bits) lo llama al cargarse.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia

// Proporciona requestAnimationFrame para GSAP y ScrollTrigger en jsdom.
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  let siguienteId = 0
  const temporizadores = new Map<number, ReturnType<typeof setTimeout>>()

  globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    const id = ++siguienteId
    const temporizador = setTimeout(() => {
      temporizadores.delete(id)
      callback(performance.now())
    }, 16)

    temporizadores.set(id, temporizador)
    return id
  }

  globalThis.cancelAnimationFrame = (id: number): void => {
    const temporizador = temporizadores.get(id)
    if (temporizador !== undefined) {
      clearTimeout(temporizador)
      temporizadores.delete(id)
    }
  }
}

// Tampoco trae los observadores que usan varios componentes de React Bits.
class ObservadorVacio {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
}

globalThis.IntersectionObserver ??= ObservadorVacio as unknown as typeof IntersectionObserver
globalThis.ResizeObserver ??= ObservadorVacio as unknown as typeof ResizeObserver

// findBy* espera 1 s por defecto; en computadores lentos el panel animado tarda más.
configure({ asyncUtilTimeout: 5000 })
