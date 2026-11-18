import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Logo from './Logo'
import { ProveedorViajesBd } from '../store/useViajesBd'
import TextType from '../../reactbits/TextType'
import Waves from '../../reactbits/Waves'
import { ONDAS_ENCABEZADO } from '../../reactbits/unab'
import NotificacionesPanel from './NotificacionesPanel'
import { api } from '../../api'
import { cerrarSesion, leerSesion } from '../../login/sesion'
import { useAdmin } from '../store/AdminContext'
import { iniciales, isoLocal, normalizarTelefono } from '../utils/format'
import { IconBack, IconBell, IconChevron, IconPanel, IconRoute, IconTruck, IconUser, IconUsers } from './icons'

const tabs = [
  { to: '/admin/panel', label: 'Panel', icon: <IconPanel /> },
  { to: '/admin/vans', label: 'Vans', icon: <IconTruck /> },
  { to: '/admin/choferes', label: 'Choferes', icon: <IconUser /> },
  { to: '/admin/pasajeros', label: 'Pasajeros', icon: <IconUsers /> },
  { to: '/admin/viajes', label: 'Viajes', icon: <IconRoute /> },
]

export default function AdminLayout() {
  const { state, pendientes, sinLeer, sincronizarCuentas, recargarConductores, recargarVans, cargarAvisosLeidos, updateAdmin, reiniciarDatos } = useAdmin()
  const [notifAbierto, setNotifAbierto] = useState(false)
  const totalAvisos = pendientes + sinLeer
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const enPerfil = pathname.startsWith('/admin/perfil')
  const enAbrirViaje = pathname.startsWith('/admin/viajes/abrir')
  const subpagina = enPerfil || enAbrirViaje
  const titulo = enPerfil ? 'Mi perfil' : enAbrirViaje ? 'Abrir viaje' : 'Panel Administración'

  // Al entrar, trae de PostgreSQL las cuentas (solicitudes por aprobar y pasajeros aprobados), las vans,
  // los avisos ya leídos y la cuenta del administrador. #2905: nada de esto se guarda en el navegador.
  // Solo una vez: sincronizarCuentas cambia en cada render.
  useEffect(() => {
    if (!leerSesion()?.token) return
    void recargarVans()
    // los conductores se piden aparte: no dependen de que cargue la lista de cuentas
    void recargarConductores()
    void cargarAvisosLeidos()
    api.miPerfil().then((r) => {
      if (!r.ok) return
      const u = r.datos.usuario
      updateAdmin({ nombre: u.nombreCompleto, email: u.correo, celular: normalizarTelefono(u.telefono) ?? u.telefono, ultimoIngreso: isoLocal(u.ultimoIngresoEn ?? u.creadoEn) })
    })
    api.listarUsuarios().then((r) => {
      if (r.ok) {
        sincronizarCuentas(r.datos.usuarios)
      }
      // La sesión expiró (dura 8 horas) o la cuenta ya no tiene acceso: vuelve al login.
      else if (r.status === 401 || r.status === 403) {
        cerrarSesion()
        reiniciarDatos(false)
        navigate('/login', { replace: true })
      }
    })
  }, [])

  return (
    <div className="adm-shell">
      <header className="adm-header">
        {/* RB-04: fondo de ondas en movimiento (React Bits Waves), detrás del contenido del encabezado */}
        <div className="adm-header__fondo" aria-hidden="true">
          <Waves {...ONDAS_ENCABEZADO} />
        </div>
        <div className="adm-header__left">
          {enAbrirViaje
            ? <button className="adm-back" onClick={() => navigate('/admin/viajes')} aria-label="Volver a viajes"><IconBack /></button>
            : <Logo variante="simbolo" alto={30} className="adm-logo" />}
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
              <p className="adm-greeting__name"><TextType as="span" text="Hola, Administrador" typingSpeed={55} loop={false} showCursor={false} /></p>
              <p className="adm-greeting__sub">Sede Central UNAB</p>
            </div>
          </div>
          <div className="adm-greeting__end">
            <span className="adm-online">Online</span>
            <IconChevron />
          </div>
        </NavLink>
      )}

      <main className="adm-content"><ProveedorViajesBd rol="admin"><Outlet /></ProveedorViajesBd></main>

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
