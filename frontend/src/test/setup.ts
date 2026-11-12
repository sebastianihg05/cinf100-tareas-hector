import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { instalarApiFalsa } from './apiFalsa'

// Ninguna prueba llama al backend real: fetch responde con un backend falso en memoria.
beforeEach(() => {
  instalarApiFalsa()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

// jsdom no trae matchMedia y gsap (React Bits) lo llama al cargarse. Responde "sin coincidencia".
window.matchMedia ??= ((query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
})) as typeof window.matchMedia

// Tampoco trae los observadores que usan varios componentes de React Bits: aquí no observan nada.
class ObservadorVacio { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } }
globalThis.IntersectionObserver ??= ObservadorVacio as unknown as typeof IntersectionObserver
globalThis.ResizeObserver ??= ObservadorVacio as unknown as typeof ResizeObserver
