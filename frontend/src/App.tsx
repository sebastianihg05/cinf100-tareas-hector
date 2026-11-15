import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import AdminLayout from './admin/components/AdminLayout'
import AbrirViaje from './admin/pages/AbrirViaje'
import PanelPendiente from './admin/pages/PanelPendiente'
import PerfilAdmin from './admin/pages/PerfilAdmin'
import VistaChoferes from './admin/pages/VistaChoferes'
import VistaPasajeros from './admin/pages/VistaPasajeros'
import VistaVans from './admin/pages/VistaVans'
import VistaViajes from './admin/pages/VistaViajes'
import { AdminProvider } from './admin/store/AdminContext'

import PasajeroLayout from './pasajero/PasajeroLayout'
import Confirmacion from './pasajero/pages/Confirmacion'
import MisReservas from './pasajero/pages/MisReservas'
import Reservar from './pasajero/pages/Reservar'
import SeleccionAsientoIda from './pasajero/pages/SeleccionAsientoIda'
import SeleccionAsientoVuelta from './pasajero/pages/SeleccionAsientoVuelta'
import PerfilPasajero from './pasajero/pages/PerfilPasajero'

import ConductorLayout from './conductor/ConductorLayout'
import HistorialViajes from './conductor/pages/HistorialViajes'
import NotificacionesConductor from './conductor/pages/NotificacionesConductor'
import PerfilConductor from './conductor/pages/PerfilConductor'
import ViajeDetalle from './conductor/pages/ViajeDetalle'
import ViajesAsignados from './conductor/pages/ViajesAsignados'

import Login from "./login/pages/Login";
import Register from "./login/pages/Register";
import RegisterSuccess from "./login/pages/RegisterSuccess";
import ForgotPassword from "./login/pages/ForgotPassword";
import RequiereRol from './login/RequiereRol'

// GPS-03: la pantalla de navegación (con el mapa) se descarga solo cuando el conductor la abre.
const NavegacionViaje = lazy(() => import('./conductor/pages/NavegacionViaje'))

// RB-03: muestra de animaciones. Carga diferida y solo en desarrollo, para que no pese en producción.
const DemoReactBits = import.meta.env.DEV ? lazy(() => import('./reactbits/DemoReactBits')) : null

export default function App() {
  return (
    <AdminProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/registro/exito" element={<RegisterSuccess />} />
        <Route path="/recuperar" element={<ForgotPassword />} />

        {/* Cada grupo exige iniciar sesión con el rol correspondiente (el que asignó el administrador). */}
        <Route element={<RequiereRol rol="admin" />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="vans" replace />} />
            <Route path="panel" element={<PanelPendiente />} />
            <Route path="vans" element={<VistaVans />} />
            <Route path="choferes" element={<VistaChoferes />} />
            <Route path="pasajeros" element={<VistaPasajeros />} />
            <Route path="viajes" element={<VistaViajes />} />
            <Route path="viajes/abrir" element={<AbrirViaje />} />
            <Route path="perfil" element={<PerfilAdmin />} />
          </Route>
        </Route>

        <Route element={<RequiereRol rol="funcionario" />}>
          <Route path="/pasajero" element={<PasajeroLayout />}>
            <Route index element={<Navigate to="reservar" replace />} />
            <Route path="reservar" element={<Reservar />} />
            <Route path="asiento/ida" element={<SeleccionAsientoIda />} />
            <Route path="asiento/vuelta" element={<SeleccionAsientoVuelta />} />
            <Route path="confirmacion" element={<Confirmacion />} />
            <Route path="reservas" element={<MisReservas />} />
            <Route path="perfil" element={<PerfilPasajero />} />
          </Route>
        </Route>

        <Route element={<RequiereRol rol="conductor" />}>
          <Route path="/conductor" element={<ConductorLayout />}>
            <Route index element={<Navigate to="viajes" replace />} />
            <Route path="viajes" element={<ViajesAsignados />} />
            <Route path="viajes/:viajeId" element={<ViajeDetalle />} />
            <Route path="viajes/:viajeId/navegacion" element={<Suspense fallback={null}><NavegacionViaje /></Suspense>} />
            <Route path="historial" element={<HistorialViajes />} />
            <Route path="avisos" element={<NotificacionesConductor />} />
            <Route path="perfil" element={<PerfilConductor />} />
          </Route>
        </Route>

        {DemoReactBits && <Route path="/demo-animaciones" element={<Suspense fallback={null}><DemoReactBits /></Suspense>} />}

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AdminProvider>
  )
}
