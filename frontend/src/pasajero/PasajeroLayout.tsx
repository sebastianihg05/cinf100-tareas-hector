import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { IconBack, IconBell, IconCalendar, IconSeat } from '../admin/components/icons'
import { BorradorProvider, useBorrador } from './borrador'

const TITULOS: Record<string, string> = {
  '/pasajero/reservar': 'Reservar Asiento',
  '/pasajero/asiento/ida': 'Selección Asiento — Ida',
  '/pasajero/asiento/vuelta': 'Selección Asiento - Vuelta',
  '/pasajero/confirmacion': 'Estado de Reserva',
  '/pasajero/reservas': 'Mis Reservas',
}

/** Marco común de la app del pasajero: barra superior, contenido y, en las pantallas principales, navegación inferior. */
function Marco() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { borrador } = useBorrador()

  const ruta = pathname.replace(/\/+$/, '')
  const titulo = TITULOS[ruta] ?? 'Reservar Asiento'
  const enAsiento = ruta.startsWith('/pasajero/asiento/')
  const enReservas = ruta === '/pasajero/reservas'
  const conNavegacion = ruta === '/pasajero/reservar' || enReservas

  const volver = () => {
    const aIda = ruta === '/pasajero/asiento/vuelta' && borrador.modalidad === 'IdaVuelta'
    navigate(aIda ? '/pasajero/asiento/ida' : '/pasajero/reservar')
  }

  return (
    <div className="psj-shell">
      <header className="psj-header">
        <div className="psj-header__left">
          {enAsiento
            ? <button type="button" className="psj-back" onClick={volver} aria-label="Volver"><IconBack /></button>
            : <span className="psj-brand">UNAB</span>}
          <h1 className="psj-title">{titulo}</h1>
        </div>
        <span className="psj-bell" role="img" aria-label="Notificaciones"><IconBell size={20} /></span>
      </header>

      <main className="psj-main"><Outlet /></main>

      {/* En el celular solo aparece en las pantallas principales; en escritorio es la barra lateral y siempre se ve. */}
      <nav className={`psj-nav${conNavegacion ? '' : ' psj-nav--solo-movil'}`} aria-label="Navegación pasajero">
        {/* "Reservar" también queda marcada durante el flujo (asientos y confirmación) */}
        <NavLink to="/pasajero/reservar" className={`psj-nav__tab${enReservas ? '' : ' is-active'}`}>
          <IconSeat size={22} /><span>Reservar</span>
        </NavLink>
        <NavLink to="/pasajero/reservas" className={({ isActive }) => `psj-nav__tab${isActive ? ' is-active' : ''}`}>
          <IconCalendar size={22} /><span>Mis Reservas</span>
        </NavLink>
      </nav>
    </div>
  )
}

export default function PasajeroLayout() {
  return (
    <BorradorProvider>
      <Marco />
    </BorradorProvider>
  )
}
