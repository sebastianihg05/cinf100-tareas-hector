import type { Admin, Chofer, EstadoReserva, Pasajero, Reserva, Trayecto, Van, Viaje } from '../types'
import { HORA_TRAYECTO, RUTA_TRAYECTO } from '../types'

export const vansIniciales: Van[] = [
  { id: 'v1', patente: 'FG-1251', asientos: 8, choferId: 'c1', activa: true },
  { id: 'v2', patente: 'SH-8568', asientos: 8, choferId: 'c2', activa: true },
  { id: 'v3', patente: 'CO-6768', asientos: 8, choferId: 'c3', activa: true },
]

export const choferesIniciales: Chofer[] = [
  { id: 'c1', nombre: 'Juan Carrasco', correo: 'juan.carrasco@unab.cl', rut: '13.987.654-7', licenciaHasta: '2027-09-06', telefono: '+56 9 0000 0000', activo: true },
  { id: 'c2', nombre: 'Alonso Iriarte', correo: 'alonso.iriarte@unab.cl', rut: '16.987.657-7', licenciaHasta: '2028-07-22', telefono: '+56 9 0000 0000', activo: true },
  { id: 'c3', nombre: 'Leonardo Burgos', correo: 'leonardo.burgos@unab.cl', rut: '14.988.654-7', licenciaHasta: '2027-09-11', telefono: '+56 9 0000 0000', activo: true },
]

export const pasajerosIniciales: Pasajero[] = [
  {
    id: 'p1', nombre: 'Nuevo ingreso', email: 'dev.nuevo.ingreso@uandresbello.edu', sede: '',
    celular: '+56 9 0000 0008', ultimoIngreso: '2026-10-01T09:12',
    aprobado: false, puedeAbrirViajes: false, habilitado: true,
  },
  {
    id: 'p2', nombre: 'Bruno Urrutia', email: 'U.bruno@uandresbello.edu', sede: 'Quillota 980',
    celular: '+56 9 0000 0009', ultimoIngreso: '2026-09-30T19:35',
    aprobado: true, puedeAbrirViajes: false, habilitado: true,
    reserva: { fecha: '2026-10-07', trayecto: 'Vuelta', asiento: 6 },
  },
  {
    id: 'p3', nombre: 'Sebastian Hidalgo', email: 'H.sebastian@uandresbello.edu', sede: 'Santiago',
    celular: '+56 9 0000 0010', ultimoIngreso: '2026-09-29T08:20',
    aprobado: true, puedeAbrirViajes: false, habilitado: true,
    reserva: { fecha: '2026-10-07', trayecto: 'Vuelta', asiento: 1 },
  },
  {
    id: 'p4', nombre: 'Hector Peña', email: 'P.pena@uandresbello.edu', sede: 'Rokamar',
    celular: '+56 9 0000 0011', ultimoIngreso: '2026-09-28T17:45',
    aprobado: true, puedeAbrirViajes: true, habilitado: true,
    reserva: { fecha: '2026-10-07', trayecto: 'Vuelta', asiento: 5 },
  },
  {
    // Funcionaria de ejemplo con reservas (se puede iniciar sesión con la contraseña de demostración)
    id: 'p5', nombre: 'Constanza Silva', email: 'S.constanza@uandresbello.edu', sede: 'Quillota 980',
    celular: '+56 9 0000 0012', ultimoIngreso: '2026-10-06T08:05',
    aprobado: true, puedeAbrirViajes: false, habilitado: true,
  },
]

/* ---------- Viajes ---------- */

const ISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Próximos días de viaje fijo (miércoles y jueves) a partir de mañana. Se calculan respecto de la fecha
 * actual para que la app del pasajero siempre tenga viajes futuros que reservar durante el desarrollo.
 */
function proximosDiasFijos(cantidad: number): string[] {
  const dias: string[] = []
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  while (dias.length < cantidad) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() === 3 || d.getDay() === 4) dias.push(ISO(d))
  }
  return dias
}

const viaje = (id: string, trayecto: Trayecto, fecha: string, vanId: string, estado: Viaje['estado'] = 'pendiente'): Viaje => ({
  id, trayecto, ...RUTA_TRAYECTO[trayecto], fecha, hora: HORA_TRAYECTO[trayecto], vanId, reservados: 0, estado,
})

const FIJOS = proximosDiasFijos(6)
const VANS_ROTATIVAS = ['v1', 'v2', 'v3']

// `reservados` se recalcula desde las reservas al cargar (ver sincronizar en store/reservas.ts).
export const viajesIniciales: Viaje[] = [
  viaje('t1', 'Ida', '2026-10-02', 'v1', 'completado'),
  viaje('t2', 'Ida', '2026-10-28', 'v2'),
  viaje('t3', 'Vuelta', '2026-10-30', 'v1'),
  viaje('t4', 'Vuelta', '2026-10-02', 'v2', 'completado'),
  viaje('t5', 'Vuelta', '2026-10-07', 'v3'),
  viaje('t6', 'Ida', '2026-09-30', 'v1', 'cancelado'),
  viaje('t7', 'Vuelta', '2026-09-30', 'v1', 'cancelado'),
  ...FIJOS.flatMap((fecha, i) => [
    viaje(`f${i + 1}i`, 'Ida', fecha, VANS_ROTATIVAS[i % 3]),
    viaje(`f${i + 1}v`, 'Vuelta', fecha, VANS_ROTATIVAS[i % 3]),
  ]),
]

/* ---------- Reservas ---------- */

let n = 0
const reserva = (
  grupoId: string, pasajeroId: string, viajeId: string, trayecto: Trayecto, asiento: number,
  estado: EstadoReserva = 'pendiente',
): Reserva => ({ id: `r${++n}`, grupoId, pasajeroId, viajeId, trayecto, asiento, estado, creadaEn: '2026-09-29T10:00' })

export const reservasIniciales: Reserva[] = [
  // Constanza: una reserva próxima, una completada y una cancelada (las tres que muestra el diseño)
  reserva('g-prox', 'p5', 'f1i', 'Ida', 3),
  reserva('g-prox', 'p5', 'f1v', 'Vuelta', 5),
  reserva('g-hist', 'p5', 't1', 'Ida', 2, 'completada'),
  reserva('g-hist', 'p5', 't4', 'Vuelta', 1, 'completada'),
  reserva('g-canc', 'p5', 't6', 'Ida', 3, 'cancelada'),
  reserva('g-canc', 'p5', 't7', 'Vuelta', 5, 'cancelada'),
  // Reservas que muestra el panel del administrador (7 oct · Vuelta: asientos 6, 1 y 5)
  reserva('g-p2-a', 'p2', 't5', 'Vuelta', 6),
  reserva('g-p3-a', 'p3', 't5', 'Vuelta', 1),
  reserva('g-p4-a', 'p4', 't5', 'Vuelta', 5),
  reserva('g-p4-b', 'p4', 't2', 'Ida', 2),
  reserva('g-p3-b', 'p3', 't3', 'Vuelta', 4),
  // Segundo día fijo con asientos ocupados 3, 6 y 8, como en las capturas de selección de asiento
  reserva('g-p2-c', 'p2', 'f2i', 'Ida', 3),
  reserva('g-p2-c', 'p2', 'f2v', 'Vuelta', 3),
  reserva('g-p3-c', 'p3', 'f2i', 'Ida', 6),
  reserva('g-p3-c', 'p3', 'f2v', 'Vuelta', 6),
  reserva('g-p4-c', 'p4', 'f2i', 'Ida', 8),
  reserva('g-p4-c', 'p4', 'f2v', 'Vuelta', 8),
]

export const adminInicial: Admin = {
  nombre: 'Admin Desarrollo',
  email: 'dev.admin@unab.cl',
  cargo: 'Administración de transporte',
  celular: '+56 9 0000 0001',
  ultimoIngreso: '2026-09-30T19:36',
}
