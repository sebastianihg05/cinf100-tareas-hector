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
