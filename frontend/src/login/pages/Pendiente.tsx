import { useNavigate } from 'react-router-dom'
import { cerrarSesion, leerSesion } from '../sesion'
import '../styles/auth.css'

/** Marcador de la pantalla de conductor, que todavía no está desarrollada. */
export default function Pendiente({ titulo }: { titulo: string }) {
  const navigate = useNavigate()
  const sesion = leerSesion()

  const salir = () => {
    cerrarSesion()
    navigate('/login', { replace: true })
  }

  return (
    <main className="auth-page">
      <section className="auth-container">
        <div className="auth-header">
          <h2>{titulo}</h2>
          <p>{sesion ? `Hola, ${sesion.nombre}. ` : ''}Esta pantalla está en desarrollo.</p>
        </div>
        <button type="button" className="primary-button" onClick={salir}>Cerrar sesión</button>
      </section>
    </main>
  )
}
