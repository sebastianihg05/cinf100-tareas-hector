import { describe, expect, test } from 'vitest'
// ?raw: Vite entrega el archivo como texto, sin procesarlo
import html from '../index.html?raw'
import icono from '../public/favicon.svg?raw'

// #2902: la pestaña del navegador muestra el escudo institucional UNAB.
describe('#2902: logo UNAB en la pestaña del navegador', () => {
  test('index.html declara el ícono SVG de la pestaña', () => {
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />')
  })

  test('el ícono es el escudo UNAB con los colores del manual', () => {
    expect(icono).toContain('<title>Universidad Andrés Bello</title>')
    expect(icono).toContain('#051C2C')
    expect(icono).toContain('#AB192D')
    // cuadrado, para que el navegador no lo deforme
    const [, , ancho, alto] = icono.match(/viewBox="([^"]+)"/)![1].split(' ').map(Number)
    expect(ancho).toBe(alto)
  })
})
