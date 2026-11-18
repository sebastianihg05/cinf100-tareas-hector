import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '../App'

// VIS-03 (#2326): accesibilidad de login, registro, recuperar contraseña y registro enviado.

const abrir = (ruta: string) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  )

describe('VIS-03: accesibilidad de las pantallas de acceso', () => {
  it('las cuatro pantallas muestran el logo institucional y un título', () => {
    for (const [ruta, titulo] of [
      ['/login', 'Iniciar sesión'],
      ['/registro', 'Crear cuenta'],
      ['/recuperar', 'Recuperar contraseña'],
      ['/registro/exito', 'Registro enviado'],
    ]) {
      const vista = abrir(ruta)
      expect(screen.getByRole('img', { name: 'Universidad Andrés Bello' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1, name: 'UNAB Transporte' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: titulo })).toBeInTheDocument()
      vista.unmount()
    }
  })

  it('el error del login se anuncia al lector de pantalla', async () => {
    abrir('/login')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar al sistema' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Completa todos los campos.')
  })

  it('el error del registro se anuncia y las validaciones siguen iguales', async () => {
    abrir('/registro')
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Completa todos los campos.')

    await userEvent.type(screen.getByLabelText('Nombre completo'), 'Ana Pérez')
    await userEvent.type(screen.getByLabelText('Correo institucional'), 'ana@gmail.com')
    await userEvent.selectOptions(screen.getByLabelText('Sede'), 'Quintay')
    await userEvent.type(screen.getByLabelText('Teléfono de contacto'), '987654321')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave12345')
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'clave12345')
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Debes utilizar un correo institucional.')
  })

  it('recuperar contraseña anuncia el error y el envío', async () => {
    abrir('/recuperar')
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@gmail.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Debes utilizar un correo institucional.')

    await userEvent.clear(screen.getByLabelText('Correo electrónico'))
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@unab.cl')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }))
    expect(screen.getByRole('status')).toHaveTextContent('Enlace de recuperación enviado')
  })

  it('el botón Ver dice qué campo muestra y cambia a Ocultar', async () => {
    abrir('/registro')
    const campo = screen.getByLabelText('Confirmar contraseña')
    expect(campo).toHaveAttribute('type', 'password')

    await userEvent.click(screen.getByRole('button', { name: 'Ver confirmar contraseña' }))
    expect(campo).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ocultar confirmar contraseña' })).toHaveAttribute('aria-controls', 'confirmarPassword')
    // el de la contraseña no cambió
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
  })

  it('los campos le dicen al navegador qué dato piden (autocompletar y gestor de contraseñas)', () => {
    const vista = abrir('/login')
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'current-password')
    vista.unmount()

    abrir('/registro')
    expect(screen.getByLabelText('Nombre completo')).toHaveAttribute('autocomplete', 'name')
    expect(screen.getByLabelText('Correo institucional')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText('Teléfono de contacto')).toHaveAttribute('autocomplete', 'tel')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('Confirmar contraseña')).toHaveAttribute('autocomplete', 'new-password')
  })

  it('el registro deja visibles las reglas de cada campo, no solo en el placeholder', () => {
    abrir('/registro')
    expect(screen.getByLabelText('Correo institucional')).toHaveAccessibleDescription('Termina en @unab.cl o @uandresbello.edu.')
    expect(screen.getByLabelText('Teléfono de contacto')).toHaveAccessibleDescription('Celular chileno, por ejemplo +56 9 1234 5678.')
    expect(screen.getByLabelText('Contraseña')).toHaveAccessibleDescription('Mínimo 8 caracteres.')
    for (const etiqueta of ['Nombre completo', 'Correo institucional', 'Sede', 'Teléfono de contacto', 'Contraseña', 'Confirmar contraseña']) {
      expect(screen.getByLabelText(etiqueta)).toHaveAttribute('aria-required', 'true')
    }
  })

  it('con el teclado se recorre el login en orden', async () => {
    abrir('/login')
    const orden = [
      screen.getByLabelText('Correo electrónico'),
      screen.getByLabelText('Contraseña'),
      screen.getByRole('button', { name: 'Ver contraseña' }),
      screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }),
      screen.getByRole('button', { name: 'Ingresar al sistema' }),
      screen.getByRole('button', { name: 'Regístrate' }),
    ]
    for (const elemento of orden) {
      await userEvent.tab()
      expect(elemento).toHaveFocus()
    }
  })
})
