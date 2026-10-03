import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './admin/components/AdminLayout'
import AbrirViaje from './admin/pages/AbrirViaje'
import PanelPendiente from './admin/pages/PanelPendiente'
import PerfilAdmin from './admin/pages/PerfilAdmin'
import SesionCerrada from './admin/pages/SesionCerrada'
import VistaChoferes from './admin/pages/VistaChoferes'
import VistaPasajeros from './admin/pages/VistaPasajeros'
import VistaVans from './admin/pages/VistaVans'
import VistaViajes from './admin/pages/VistaViajes'
import { AdminProvider } from './admin/store/AdminContext'

export default function App() {
  return (
    <AdminProvider>
      <Routes>
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
        <Route path="/login" element={<SesionCerrada />} />
        <Route path="*" element={<Navigate to="/admin/vans" replace />} />
      </Routes>
    </AdminProvider>
  )
}
