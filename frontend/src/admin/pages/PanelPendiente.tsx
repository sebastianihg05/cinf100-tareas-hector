import { Link } from 'react-router-dom'
import GraficoBarras, { type Barra, type TonoBarra } from '../components/GraficoBarras'
import GraficoTorta from '../components/GraficoTorta'
import { IconBan, IconClock, IconRoute, IconTruck } from '../components/icons'
import Indicador from '../components/Indicador'
import { useAdmin } from '../store/AdminContext'
import { SEDES, type EstadoViaje } from '../types'
import { fechaCorta, todayISO } from '../utils/format'
import { estadoLicencia } from '../utils/licencia'
import './PanelPendiente.css'

/**
 * Panel (dashboard) del administrador.
 * Solo lee el estado compartido: cada indicador, barra y leyenda es un enlace hacia la vista
 * donde se gestiona ese dato (vans, choferes, pasajeros, viajes).
 */

const porcentaje = (parte: number, total: number) => (total > 0 ? (parte / total) * 100 : 0)

const ESTADOS: { clave: EstadoViaje; etiqueta: string; tono: TonoBarra }[] = [
  { clave: 'pendiente', etiqueta: 'Pendientes', tono: 'amarillo' },
  { clave: 'en-curso', etiqueta: 'En curso', tono: 'azul' },
  { clave: 'completado', etiqueta: 'Completados', tono: 'turquesa' },
  { clave: 'cancelado', etiqueta: 'Cancelados', tono: 'rojo' },
]

export default function PanelPendiente() {
  const { state, asientosOcupadosDe } = useAdmin()

  /* ---------- Usuarios, conductores y vans ---------- */
  const pendientes = state.pasajeros.filter((p) => !p.aprobado).length
  const deshabilitados = state.pasajeros.filter((p) => p.aprobado && !p.habilitado).length
  const activos = state.pasajeros.filter((p) => p.aprobado && p.habilitado).length
  const usuariosAprobados = state.pasajeros.filter((p) => p.aprobado).length

  const conductoresActivos = state.choferes.filter((c) => c.activo).length
  const conductoresDeBaja = state.choferes.length - conductoresActivos
  const vansActivas = state.vans.filter((v) => v.activa).length

  // OP-841: conductores con la licencia vencida o por vencer
  const licenciasEnRiesgo = state.choferes.filter((c) => c.activo && estadoLicencia(c.licenciaHasta) !== 'ok').length

  /* ---------- Viajes ---------- */
  const cuenta = (estado: EstadoViaje) => state.viajes.filter((v) => v.estado === estado).length

  const maxEstado = Math.max(1, ...ESTADOS.map((e) => cuenta(e.clave)))
  const barrasEstado: Barra[] = ESTADOS.map((e) => ({
    clave: e.clave, etiqueta: e.etiqueta, tono: e.tono,
    porcentaje: porcentaje(cuenta(e.clave), maxEstado), valor: String(cuenta(e.clave)),
    to: `/admin/viajes?filtro=${e.clave}`,
  }))

  const pasajerosPorSede = SEDES.map((sede) => ({ sede: sede as string, n: state.pasajeros.filter((p) => p.sede === sede).length }))
  const maxSede = Math.max(1, ...pasajerosPorSede.map((x) => x.n))
  const barrasSede: Barra[] = pasajerosPorSede.map((x) => ({
    clave: x.sede, etiqueta: x.sede, tono: 'navy', porcentaje: porcentaje(x.n, maxSede), valor: String(x.n),
    to: `/admin/pasajeros?filtro=${encodeURIComponent(x.sede)}`,
  }))

  const hoy = todayISO()
  const barrasOcupacion: Barra[] = state.viajes
    .filter((v) => v.estado === 'pendiente' && v.fecha >= hoy)
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))
    .slice(0, 5)
    .map((v) => {
      const capacidad = state.vans.find((x) => x.id === v.vanId)?.asientos
      const ocupados = asientosOcupadosDe(v.id).length
      return {
        clave: v.id,
        // la hora ya indica el trayecto (06:45 ida, 17:00 vuelta)
        etiqueta: `${fechaCorta(v.fecha)} · ${v.hora}`,
        tono: 'turquesa' as TonoBarra,
        porcentaje: capacidad ? porcentaje(ocupados, capacidad) : 0,
        valor: capacidad ? `${ocupados}/${capacidad}` : 'Sin van',
        to: '/admin/viajes',
      }
    })

  return (
    <div className="dashboard">
      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <h2>Verificación de usuarios y conductores</h2>
          {pendientes > 0 && (
            <Link to="/admin/pasajeros?filtro=por-aprobar" className="dashboard-pending-warning">
              {pendientes} pendiente{pendientes >= 2 ? 's' : ''}
            </Link>
          )}
        </div>
        <p className="dashboard-section__text">Revisa solicitudes pendientes y actualiza el estado de los perfiles.</p>

        <div className="dashboard-counts">
          <Indicador variante="conteo" to="/admin/pasajeros" etiqueta="Usuarios" valor={usuariosAprobados} />
          <Indicador variante="conteo" to="/admin/choferes" etiqueta="Conductores" valor={conductoresActivos} />
          <Indicador variante="conteo" to="/admin/vans" etiqueta="Vans activas" valor={vansActivas} />
        </div>
      </section>

      {licenciasEnRiesgo > 0 && (
        <Link to="/admin/choferes" className="dashboard-alert">
          <IconBan size={20} />
          <span>
            {licenciasEnRiesgo === 1
              ? '1 conductor con licencia vencida o por vencer'
              : `${licenciasEnRiesgo} conductores con licencia vencida o por vencer`}
          </span>
        </Link>
      )}

      <section className="dashboard-trips">
        <Indicador to="/admin/viajes" etiqueta="Viajes totales" valor={state.viajes.length} tono="blue" icono={<IconRoute size={20} />} />
        <Indicador to="/admin/viajes?filtro=pendiente" etiqueta="Viajes pendientes" valor={cuenta('pendiente')} tono="yellow" icono={<IconClock size={20} />} />
        <Indicador to="/admin/viajes?filtro=en-curso" etiqueta="Viajes en curso" valor={cuenta('en-curso')} tono="blue" icono={<IconTruck size={20} />} />
        <Indicador to="/admin/viajes?filtro=completado" etiqueta="Viajes completados" valor={cuenta('completado')} tono="turquoise" icono={<IconRoute size={20} />} />
      </section>

      <Link to="/admin/viajes?filtro=cancelado" className="dashboard-cancelled">
        <span className="dashboard-cancelled__label">
          <IconBan size={20} />
          <span>Viajes cancelados</span>
        </span>
        <strong>{cuenta('cancelado')}</strong>
      </Link>

      <section className="dashboard-section">
        <h2>Gráficos de barras</h2>
        <div className="dashboard-charts">
          <GraficoBarras titulo="Viajes por estado" subtitulo="Toca una barra para ver los viajes"
            barras={barrasEstado} vacio="Aún no hay viajes." />
          <GraficoBarras titulo="Pasajeros por sede" subtitulo="Toca una barra para filtrar la lista"
            barras={barrasSede} vacio="Aún no hay pasajeros." />
          <GraficoBarras titulo="Ocupación de los próximos viajes" subtitulo="Asientos reservados sobre la capacidad de la van"
            barras={barrasOcupacion} vacio="No hay viajes pendientes próximos." />
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Distribución del panel</h2>
        <div className="dashboard-charts dashboard-charts--two">
          <GraficoTorta titulo="Usuarios" segmentos={[
            { etiqueta: 'Pendientes', valor: pendientes, color: '#e0a800', to: '/admin/pasajeros?filtro=por-aprobar' },
            { etiqueta: 'Deshabilitados', valor: deshabilitados, color: '#94a3b8', to: '/admin/pasajeros' },
            { etiqueta: 'Activos', valor: activos, color: '#00a6a6', to: '/admin/pasajeros' },
          ]} />
          <GraficoTorta titulo="Conductores" segmentos={[
            { etiqueta: 'Activos', valor: conductoresActivos, color: '#00a6a6', to: '/admin/choferes' },
            { etiqueta: 'Dados de baja', valor: conductoresDeBaja, color: '#cc0033', to: '/admin/choferes' },
          ]} />
        </div>
      </section>
    </div>
  )
}
