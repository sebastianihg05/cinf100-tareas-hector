import Logo from '../../admin/components/Logo'

/** Logo institucional y nombre de la app: el mismo encabezado en todas las pantallas de acceso (VIS-02, VIS-03). */
export default function MarcaAuth() {
  return (
    <div className="brand">
      <Logo variante="negativo" alto={60} className="auth-logo" />

      <div className="brand-text">
        <h1>UNAB Transporte</h1>
        <p>Sistema de gestión de rutas</p>
      </div>
    </div>
  )
}
