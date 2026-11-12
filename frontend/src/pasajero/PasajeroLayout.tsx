import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { IconBack, IconBell, IconCalendar, IconSeat, IconUser } from '../admin/components/icons'
import Logo from '../admin/components/Logo'
import PanelAvisos from '../admin/components/PanelAvisos'
import { BorradorProvider, useBorrador } from './borrador'
import { useAvisosPasajero } from './useAvisosPasajero'
import Waves from '../reactbits/Waves'
import { UNAB } from '../reactbits/unab'

const TITULOS: Record<string, string> = {
  '/pasajero/reservar': 'Reservar Asiento',
  '/pasajero/asiento/ida': 'Selección Asiento — Ida',
  '/pasajero/asiento/vuelta': 'Selección Asiento - Vuelta',
  '/pasajero/confirmacion': 'Estado de Reserva',
  '/pasajero/reservas': 'Mis Reservas',
  '/pasajero/perfil': 'Mi perfil',
}

/** Marco común de la app del pasajero: barra superior, contenido y, en las pantallas principales, navegación inferior. */
function Marco() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { borrador } = useBorrador()
  const { avisos, sinLeer, marcarLeido, marcarTodos } = useAvisosPasajero()
  const [avisosAbiertos, setAvisosAbiertos] = useState(false)

  const ruta = pathname.replace(/\/+$/, '')
  const titulo = TITULOS[ruta] ?? 'Reservar Asiento'
  const enAsiento = ruta.startsWith('/pasajero/asiento/')
  const enReservas = ruta === '/pasajero/reservas'
  const enPerfil = ruta === '/pasajero/perfil'
  const conNavegacion = ruta === '/pasajero/reservar' || enReservas || enPerfil

  const volver = () => {
    const aIda = ruta === '/pasajero/asiento/vuelta' && borrador.modalidad === 'IdaVuelta'
    navigate(aIda ? '/pasajero/asiento/ida' : '/pasajero/reservar')
  }

  return (
    <div className="psj-shell">
      <header className="psj-header">
        {/* RB-05: mismo fondo de ondas que el panel administrativo */}
        <div className="adm-header__fondo" aria-hidden="true">
          <Waves lineColor="rgba(255,255,255,.22)" accentColor={UNAB.rojo} backgroundColor={UNAB.navy} />
        </div>
        <div className="psj-header__left">
          {enAsiento
            ? <button type="button" className="psj-back" onClick={volver} aria-label="Volver"><IconBack /></button>
            : <Logo variante="simbolo" alto={36} className="psj-logo" />}
          <h1 className="psj-title">{titulo}</h1>
        </div>
        <button type="button" className="psj-bell" onClick={() => setAvisosAbiertos((a) => !a)} aria-expanded={avisosAbiertos}
          aria-label={sinLeer > 0 ? `Notificaciones: ${sinLeer} sin leer` : 'Notificaciones'}>
          <IconBell size={20} />
          {sinLeer > 0 && <span className="adm-bell__count">{sinLeer > 9 ? '9+' : sinLeer}</span>}
        </button>
        {avisosAbiertos && (
          <PanelAvisos
            sinLeer={sinLeer}
            vacio="No tienes notificaciones."
            onMarcarLeidas={marcarTodos}
            onClose={() => setAvisosAbiertos(false)}
            avisos={avisos.map((a) => ({
              id: a.id, titulo: a.titulo, lineas: a.lineas, sinLeer: !a.leido,
              onSeleccionar: () => { marcarLeido(a.id); setAvisosAbiertos(false); navigate('/pasajero/reservas') },
            }))}
          />
        )}
      </header>

      <main className="psj-main">
        {/* RB-05: cada vista aparece con un fundido (CSS .psj-vista); solo opacidad, porque un transform rompería el pie fijo */}
        <div key={pathname} className="psj-vista"><Outlet /></div>
      </main>

      {/* En el celular solo aparece en las pantallas principales; en escritorio es la barra lateral y siempre se ve. */}
      <nav className={`psj-nav${conNavegacion ? '' : ' psj-nav--solo-movil'}`} aria-label="Navegación pasajero">
        {/* "Reservar" también queda marcada durante el flujo (asientos y confirmación) */}
        <NavLink to="/pasajero/reservar" className={`psj-nav__tab${enReservas || enPerfil ? '' : ' is-active'}`}>
          <IconSeat size={22} /><span>Reservar</span>
        </NavLink>
        <NavLink to="/pasajero/reservas" className={({ isActive }) => `psj-nav__tab${isActive ? ' is-active' : ''}`}>
          <IconCalendar size={22} /><span>Mis Reservas</span>
        </NavLink>
        <NavLink to="/pasajero/perfil" className={({ isActive }) => `psj-nav__tab${isActive ? ' is-active' : ''}`}>
          <IconUser size={22} /><span>Perfil</span>
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
