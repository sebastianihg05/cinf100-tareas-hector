import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import NotificacionesPanel from './NotificacionesPanel'
import { useAdmin } from '../store/AdminContext'
import { iniciales } from '../utils/format'
import { IconBack, IconBell, IconChevron, IconPanel, IconRoute, IconTruck, IconUser, IconUsers } from './icons'

const tabs = [
  { to: '/admin/panel', label: 'Panel', icon: <IconPanel /> },
  { to: '/admin/vans', label: 'Vans', icon: <IconTruck /> },
  { to: '/admin/choferes', label: 'Choferes', icon: <IconUser /> },
  { to: '/admin/pasajeros', label: 'Pasajeros', icon: <IconUsers /> },
  { to: '/admin/viajes', label: 'Viajes', icon: <IconRoute /> },
]

export default function AdminLayout() {
  const { state, pendientes, sinLeer } = useAdmin()
  const [notifAbierto, setNotifAbierto] = useState(false)
  const totalAvisos = pendientes + sinLeer
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const enPerfil = pathname.startsWith('/admin/perfil')
  const enAbrirViaje = pathname.startsWith('/admin/viajes/abrir')
  const subpagina = enPerfil || enAbrirViaje
  const titulo = enPerfil ? 'Mi perfil' : enAbrirViaje ? 'Abrir viaje' : 'Panel Administración'

  return (
    <div className="adm-shell">
      <header className="adm-header">
        <div className="adm-header__left">
          {enAbrirViaje
            ? <button className="adm-back" onClick={() => navigate('/admin/viajes')} aria-label="Volver a viajes"><IconBack /></button>
            : <span className="adm-brand">UNAB</span>}
          <h1 className="adm-title">{titulo}</h1>
        </div>
        <button className="adm-bell" onClick={() => setNotifAbierto((a) => !a)} aria-expanded={notifAbierto}
          aria-label={totalAvisos > 0 ? `Notificaciones: ${totalAvisos} sin atender` : 'Notificaciones'}>
          <IconBell />
          {totalAvisos > 0 && <span className="adm-bell__count">{totalAvisos > 9 ? '9+' : totalAvisos}</span>}
        </button>
        {notifAbierto && <NotificacionesPanel onClose={() => setNotifAbierto(false)} />}
      </header>

      {!subpagina && (
        <NavLink to="/admin/perfil" className="adm-greeting" aria-label="Ir a mi perfil">
          <div className="adm-greeting__user">
            <div className="adm-avatar">{iniciales(state.admin.nombre)}</div>
            <div>
              <p className="adm-greeting__name">Hola, Administrador</p>
              <p className="adm-greeting__sub">Sede Central UNAB</p>
            </div>
          </div>
          <div className="adm-greeting__end">
            <span className="adm-online">Online</span>
            <IconChevron />
          </div>
        </NavLink>
      )}

      <main className="adm-content"><Outlet /></main>

      <nav className="adm-nav" aria-label="Navegación administrador">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => `adm-nav__tab${isActive ? ' is-active' : ''}`}>
            {t.icon}<span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
