import { Link } from 'react-router-dom'

/** Marcador: la pantalla de login real la desarrolla otro integrante. */
export default function SesionCerrada() {
  return (
    <div className="adm-closed">
      <span className="adm-brand">UNAB</span>
      <h1>Sesión cerrada</h1>
      <p>Cerraste sesión correctamente.</p>
      <Link className="adm-btn adm-btn--primary" to="/admin/vans">Volver a ingresar</Link>
    </div>
  )
}
