import { IconBan, IconClock, IconRoute, IconTruck } from '../components/icons'
import { useAdmin } from '../store/AdminContext'

export default function PanelPendiente() {
    const { state } = useAdmin()

    const usuariosAprobados = state.pasajeros.filter((p) => p.aprobado).length
    const usuariosPendientes = state.pasajeros.filter((p) => !p.aprobado).length
    const conductoresActivos = state.choferes.filter((c) => c.activo).length

    const totalViajes = state.viajes.length
    const pendientes = state.viajes.filter((v) => v.estado === 'pendiente').length
    const enCurso = state.viajes.filter((v) => v.estado === 'en-curso').length
    const completados = state.viajes.filter((v) => v.estado === 'completado').length
    const cancelados = state.viajes.filter((v) => v.estado === 'cancelado').length

    const pasajerosPendientes = state.pasajeros.filter(
        (p) => !p.aprobado
    ).length

    const pasajerosVerificados = state.pasajeros.filter(
        (p) => p.aprobado && !p.habilitado
    ).length

    const pasajerosActivos = state.pasajeros.filter(
        (p) => p.aprobado && p.habilitado
    ).length

    const totalPasajeros =
        pasajerosPendientes + pasajerosVerificados + pasajerosActivos

    const porcentajePendientes =
        totalPasajeros > 0
            ? (pasajerosPendientes / totalPasajeros) * 100
            : 0

    const porcentajeVerificados =
        totalPasajeros > 0
            ? (pasajerosVerificados / totalPasajeros) * 100
            : 0

    const inicioVerificados = porcentajePendientes
    const inicioActivos = porcentajePendientes + porcentajeVerificados

    // Conductores
    const conductoresDadosDeBaja = state.choferes.filter(
        (c) => !c.activo
    ).length

    const totalConductores =
        conductoresActivos + conductoresDadosDeBaja

    const porcentajeConductoresActivos =
        totalConductores > 0
            ? (conductoresActivos / totalConductores) * 100
            : 0

    return (
        <>
        <style>
        {`
          .dashboard {
            display: flex;
            flex-direction: column;
            gap: 16px;
            width: 100%;
          }

          .dashboard-verification {
            background: #ffffff;
            border: 1px solid #dce2e8;
            border-radius: 14px;
            padding: 18px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, .05);
          }

          .dashboard-verification__header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }

          .dashboard-verification h2 {
            margin: 0;
            color: #003366;
            font-size: 18px;
            font-weight: 800;
          }

          .dashboard-pending-warning {
            flex-shrink: 0;
            padding: 5px 9px;
            border-radius: 6px;
            background: #fff3cd;
            color: #856404;
            font-size: 10px;
            font-weight: 700;
          }

          .dashboard-verification p {
            margin: 6px 0 18px;
            color: #6b7280;
            font-size: 12px;
            line-height: 1.45;
          }

          .dashboard-verification__counts {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }

          .dashboard-verification__item {
            background: #f8fafc;
            border: 1px solid #dce2e8;
            border-radius: 12px;
            padding: 16px;
            min-height: 90px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 5px rgba(0, 0, 0, .04);
          }

          .dashboard-verification__item strong {
            color: #003366;
            font-size: 28px;
            font-weight: 800;
          }

          .dashboard-verification__item span {
            margin-top: 4px;
            color: #6b7280;
            font-size: 12px;
            font-weight: 700;
          }

          .dashboard-trip-grid {
            width: 94%;
            max-width: 760px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }

          .dashboard-trip-card {
            min-height: 88px;
            background: #ffffff;
            border: 1px solid #dce2e8;
            color: #003366;
            border-radius: 12px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: center;
            text-align: left;
            box-shadow: 0 3px 8px rgba(0, 0, 0, .05);
            position: relative;
          }

          .dashboard-trip-card span {
            margin: 0;
            color: #6b7280;
            font-size: 12px;
            font-weight: 700;
          }

          .dashboard-trip-card strong {
            margin-top: 2px;
            font-size: 26px;
            font-weight: 800;
            color: #003366;
          }

          .dashboard-trip-card__icon {
            position: absolute;
            top: 10px;
            right: 10px;
            color: #003366;
            opacity: 0.6;
          }

          .dashboard-trip-card--blue strong,
          .dashboard-trip-card--blue .dashboard-trip-card__icon {
            color: #0066cc;
          }

          .dashboard-trip-card--yellow strong,
          .dashboard-trip-card--yellow .dashboard-trip-card__icon {
            color: #e0a800;
          }

          .dashboard-trip-card--turquoise strong,
          .dashboard-trip-card--turquoise .dashboard-trip-card__icon {
            color: #00a6a6;
          }

          .dashboard-cancelled {
            min-height: 60px;
            background: #fff1f2;
            border: 1px solid #cc0033;
            border-radius: 14px;
            padding: 14px 18px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 4px 10px rgba(0, 0, 0, .05);
            color: #cc0033;
          }

          .dashboard-cancelled__label {
            display: flex;
            align-items: center;
            gap: 9px;
            color: #cc0033;
            font-size: 13px;
            font-weight: 700;
          }

          .dashboard-cancelled__icon {
            flex-shrink: 0;
          }

          .dashboard-cancelled strong {
            color: #cc0033;
            font-size: 28px;
            font-weight: 800;
          }

          .dashboard-distribution {
            background: #ffffff;
            border: 1px solid #dce2e8;
            border-radius: 14px;
            padding: 18px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, .05);
          }

          .dashboard-distribution h2 {
            margin: 0 0 14px;
            color: #003366;
            font-size: 18px;
            font-weight: 800;
          }

          .dashboard-distribution__grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }

          .dashboard-distribution__item {
            min-height: 240px;
            background: #f8fafc;
            border: 1px solid #dce2e8;
            border-radius: 12px;
            padding: 16px;
            color: #003366;
            font-size: 15px;
            font-weight: 800;
            box-shadow: 0 2px 5px rgba(0, 0, 0, .04);
          }

          .dashboard-distribution__title {
            text-align: center;
            margin-bottom: 12px;
          }

          .dashboard-pie-container {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 24px;
            flex-wrap: wrap;
          }

          .dashboard-pie {
            width: 150px;
            height: 150px;
            border-radius: 50%;
            background: conic-gradient(
              #e0a800 0% ${inicioVerificados}%,
              #0066cc ${inicioVerificados}% ${inicioActivos}%,
              #00a6a6 ${inicioActivos}% 100%
            );
            position: relative;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .dashboard-pie::after {
            content: '';
            position: absolute;
            inset: 35px;
            background: #f8fafc;
            border-radius: 50%;
          }

          .dashboard-pie__center {
            position: relative;
            z-index: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            line-height: 1.1;
          }

          .dashboard-pie__center span {
            color: #6b7280;
            font-size: 11px;
            font-weight: 700;
          }

          .dashboard-pie__center strong {
            margin-top: 3px;
            color: #0066cc;
            font-size: 24px;
            font-weight: 800;
          }

          .dashboard-pie-legend {
            display: flex;
            flex-direction: column;
            gap: 9px;
          }

          .dashboard-pie-legend__item {
            display: flex;
            align-items: center;
            gap: 7px;
            color: #6b7280;
            font-size: 12px;
            font-weight: 700;
          }

          .dashboard-pie-legend__dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            flex-shrink: 0;
          }

          .dashboard-pie-legend__dot--pending {
            background: #e0a800;
          }

          .dashboard-pie-legend__dot--verified {
            background: #0066cc;
          }

          .dashboard-pie-legend__dot--active {
            background: #00a6a6;
          }

          .dashboard-pie-legend__dot--driver-active {
            background: #00a6a6;
          }

          .dashboard-pie-legend__dot--driver-off {
            background: #cc0033;
          }

          .dashboard-pie-legend__item strong {
            color: #003366;
            margin-left: 2px;
          }

          .dashboard-pie--drivers {
            background: conic-gradient(
              #00a6a6 0% ${porcentajeConductoresActivos}%,
              #cc0033 ${porcentajeConductoresActivos}% 100%
            );
          }

          @media (max-width: 480px) {
            .dashboard-trip-grid {
              width: 96%;
              gap: 8px;
            }

            .dashboard-trip-card {
              min-height: 84px;
              padding: 11px;
            }

            .dashboard-trip-card span {
              font-size: 11px;
            }

            .dashboard-trip-card strong {
              font-size: 24px;
            }

            .dashboard-trip-card__icon {
              top: 9px;
              right: 9px;
            }

            .dashboard-cancelled {
              padding: 13px 14px;
            }

            .dashboard-cancelled__label {
              font-size: 12px;
            }

            .dashboard-cancelled strong {
              font-size: 25px;
            }

            .dashboard-distribution__grid {
              grid-template-columns: 1fr;
            }

            .dashboard-pie-container {
              gap: 16px;
            }

            .dashboard-pie {
              width: 130px;
              height: 130px;
            }

            .dashboard-pie::after {
              inset: 30px;
            }

            .dashboard-pie__center span {
              font-size: 10px;
            }

            .dashboard-pie__center strong {
              font-size: 21px;
            }
          }

          @media (min-width: 640px) {
            .dashboard-trip-grid {
              gap: 12px;
            }

            .dashboard-trip-card {
              min-height: 95px;
            }
          }

          @media (min-width: 900px) {
            .dashboard {
              max-width: 900px;
              margin: 0 auto;
            }

            .dashboard-verification h2 {
              font-size: 20px;
            }

            .dashboard-verification p {
              font-size: 13px;
            }

            .dashboard-trip-grid {
              width: 90%;
            }

            .dashboard-trip-card {
              min-height: 100px;
            }
          }
        `}
</style>

    < div className = "dashboard" >

        <section className="dashboard-verification" >

            <div className="dashboard-verification__header" >
                <h2>Verificación de usuarios y conductores </h2>

{
    usuariosPendientes > 0 && (
        <small className="dashboard-pending-warning" >
        { usuariosPendientes } pendiente{ usuariosPendientes >= 2 ? 's' : '' }
    </small>
            )
}
</div>

    <p>
            Revisa solicitudes pendientes y actualiza el estado de los perfiles.
          </p>

    < div className = "dashboard-verification__counts" >

        <div className="dashboard-verification__item" >
            <strong>{ usuariosAprobados } </strong>
            < span > Usuarios </span>
            </div>

            < div className = "dashboard-verification__item" >
                <strong>{ conductoresActivos } </strong>
                < span > Conductores </span>
                </div>

                </div>
                </section>

                < section className = "dashboard-trip-grid" >

                    <div className="dashboard-trip-card dashboard-trip-card--blue" >
                        <span>Viajes totales </span>
                            < strong > { totalViajes } </strong>

                            < span className = "dashboard-trip-card__icon" >
                                <IconRoute size={ 20 } />
                                    </span>
                                    </div>

                                    < div className = "dashboard-trip-card dashboard-trip-card--yellow" >
                                        <span>Viajes pendientes </span>
                                            < strong > { pendientes } </strong>

                                            < span className = "dashboard-trip-card__icon" >
                                                <IconClock size={ 20 } />
                                                    </span>
                                                    </div>

                                                    < div className = "dashboard-trip-card dashboard-trip-card--blue" >
                                                        <span>Viajes en curso </span>
                                                            < strong > { enCurso } </strong>

                                                            < span className = "dashboard-trip-card__icon" >
                                                                <IconTruck size={ 20 } />
                                                                    </span>
                                                                    </div>

                                                                    < div className = "dashboard-trip-card dashboard-trip-card--turquoise" >
                                                                        <span>Viajes completados </span>
                                                                            < strong > { completados } </strong>

                                                                            < span className = "dashboard-trip-card__icon" >
                                                                                <IconRoute size={ 20 } />
                                                                                    </span>
                                                                                    </div>

                                                                                    </section>

                                                                                    < section className = "dashboard-cancelled" >

                                                                                        <div className="dashboard-cancelled__label" >
                                                                                            <IconBan size={ 20 } />
                                                                                                < span > Viajes cancelados esta semana </span>
                                                                                                    </div>

                                                                                                    < strong > { cancelados } </strong>

                                                                                                    </section>

                                                                                                    < section className = "dashboard-distribution" >

                                                                                                        <h2>Distribución del panel </h2>

                                                                                                            < div className = "dashboard-distribution__grid" >

                                                                                                                <div className="dashboard-distribution__item" >

                                                                                                                    <div className="dashboard-distribution__title" >
                                                                                                                        Usuarios
                                                                                                                        </div>

                                                                                                                        < div className = "dashboard-pie-container" >

                                                                                                                            <div className="dashboard-pie" >

                                                                                                                                <div className="dashboard-pie__center" >
                                                                                                                                    <span>Total </span>
                                                                                                                                    < strong > { totalPasajeros } </strong>
                                                                                                                                    </div>

                                                                                                                                    </div>

                                                                                                                                    < div className = "dashboard-pie-legend" >

                                                                                                                                        <div className="dashboard-pie-legend__item" >
                                                                                                                                            <span className="dashboard-pie-legend__dot dashboard-pie-legend__dot--pending" />
                                                                                                                                                Pendientes
                                                                                                                                                < strong > { pasajerosPendientes } </strong>
                                                                                                                                                </div>

                                                                                                                                                < div className = "dashboard-pie-legend__item" >
                                                                                                                                                    <span className="dashboard-pie-legend__dot dashboard-pie-legend__dot--verified" />
                                                                                                                                                        Verificados
                                                                                                                                                        < strong > { pasajerosVerificados } </strong>
                                                                                                                                                        </div>

                                                                                                                                                        < div className = "dashboard-pie-legend__item" >
                                                                                                                                                            <span className="dashboard-pie-legend__dot dashboard-pie-legend__dot--active" />
                                                                                                                                                                Activos
                                                                                                                                                                < strong > { pasajerosActivos } </strong>
                                                                                                                                                                </div>

                                                                                                                                                                </div>

                                                                                                                                                                </div>

                                                                                                                                                                </div>

                                                                                                                                                                < div className = "dashboard-distribution__item" >

                                                                                                                                                                    <div className="dashboard-distribution__title" >
                                                                                                                                                                        Conductores
                                                                                                                                                                        </div>

                                                                                                                                                                        < div className = "dashboard-pie-container" >

                                                                                                                                                                            <div className="dashboard-pie dashboard-pie--drivers" >

                                                                                                                                                                                <div className="dashboard-pie__center" >
                                                                                                                                                                                    <span>Total </span>
                                                                                                                                                                                    < strong > { totalConductores } </strong>
                                                                                                                                                                                    </div>

                                                                                                                                                                                    </div>

                                                                                                                                                                                    < div className = "dashboard-pie-legend" >

                                                                                                                                                                                        <div className="dashboard-pie-legend__item" >
                                                                                                                                                                                            <span className="dashboard-pie-legend__dot dashboard-pie-legend__dot--driver-active" />
                                                                                                                                                                                                Activos
                                                                                                                                                                                                < strong > { conductoresActivos } </strong>
                                                                                                                                                                                                </div>

                                                                                                                                                                                                < div className = "dashboard-pie-legend__item" >
                                                                                                                                                                                                    <span className="dashboard-pie-legend__dot dashboard-pie-legend__dot--driver-off" />
                                                                                                                                                                                                        Dados de baja
                                                                                                                                                                                                            < strong > { conductoresDadosDeBaja } </strong>
                                                                                                                                                                                                            </div>

                                                                                                                                                                                                            </div>

                                                                                                                                                                                                            </div>

                                                                                                                                                                                                            </div>

                                                                                                                                                                                                            </div>

                                                                                                                                                                                                            </section>

                                                                                                                                                                                                            </div>
                                                                                                                                                                                                            </>
  )
}