import { Link, Outlet, useLocation } from 'react-router-dom'
import { IconBack, IconCalendar, IconRoute, IconUser } from '../admin/components/icons'
import Logo from '../admin/components/Logo'

const TITULOS: Record<string, string> = {
  '/conductor/viajes': 'Panel del conductor',
  '/conductor/historial': 'Historial de viajes',
  '/conductor/perfil': 'Mi perfil',
}

/**
 * Marco común del panel del conductor: barra superior, contenido y navegación inferior
 * (en escritorio pasa a ser la barra lateral). Reutiliza el marco visual `psj-*` del pasajero.
 */
export default function ConductorLayout() {
  const { pathname, state } = useLocation()
  const ruta = pathname.replace(/\/+$/, '')
  const enDetalle = ruta.startsWith('/conductor/viajes/')
  // Al abrir un viaje desde el historial, "volver" y la pestaña marcada son los del historial.
  const origen = enDetalle ? (state as { desde?: string } | null)?.desde : undefined
  const desdeHistorial = origen === 'historial'
  const volverA = desdeHistorial
    ? '/conductor/historial'
    : origen === 'listado-historial'
      ? '/conductor/viajes?tab=historial'
      : '/conductor/viajes'
  const titulo = enDetalle ? 'Detalle del viaje' : TITULOS[ruta] ?? 'Panel del conductor'

  const clase = (activa: boolean) => `psj-nav__tab${activa ? ' is-active' : ''}`
  const enViajes = ruta === '/conductor/viajes' || (enDetalle && !desdeHistorial)
  const enPerfil = ruta === '/conductor/perfil'
  const enHistorial = ruta === '/conductor/historial' || desdeHistorial

  return (
    <div className="psj-shell">
      <header className="psj-header">
        <div className="psj-header__left">
          {enDetalle
            ? <Link to={volverA} className="psj-back" aria-label={desdeHistorial ? 'Volver al historial' : 'Volver a mis viajes'}><IconBack /></Link>
            : <Logo variante="simbolo" alto={36} className="psj-logo" />}
          <h1 className="psj-title">{titulo}</h1>
        </div>
      </header>

      <main className="psj-main"><Outlet /></main>

      <nav className="psj-nav" aria-label="Navegación conductor">
        {/* Link y no NavLink: la pestaña activa también depende de desde dónde se abrió el detalle de un viaje. */}
        <Link to="/conductor/viajes" className={clase(enViajes)} aria-current={enViajes ? 'page' : undefined}>
          <IconRoute size={22} /><span>Mis viajes</span>
        </Link>
        <Link to="/conductor/historial" className={clase(enHistorial)} aria-current={enHistorial ? 'page' : undefined}>
          <IconCalendar size={22} /><span>Historial</span>
        </Link>
        <Link to="/conductor/perfil" className={clase(enPerfil)} aria-current={enPerfil ? 'page' : undefined}>
          <IconUser size={22} /><span>Perfil</span>
        </Link>
      </nav>
    </div>
  )
}
