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

import Login from './pages/Login'
import Register from './pages/Register'
import RegisterSuccess from './pages/RegisterSuccess'
import ForgotPassword from './pages/ForgotPassword'

export default function App() {
  return (
    <AdminProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/registro/exito" element={<RegisterSuccess />} />
        <Route path="/recuperar" element={<ForgotPassword />} />

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

        <Route path="/pasajero" element={<PasajeroLayout />}>
          <Route index element={<Navigate to="reservar" replace />} />
          <Route path="reservar" element={<Reservar />} />
          <Route path="asiento/ida" element={<SeleccionAsientoIda />} />
          <Route path="asiento/vuelta" element={<SeleccionAsientoVuelta />} />
          <Route path="confirmacion" element={<Confirmacion />} />
          <Route path="reservas" element={<MisReservas />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AdminProvider>
  )
}
