import type { Admin, Chofer, Pasajero, Van, Viaje } from '../types'

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
]

export const viajesIniciales: Viaje[] = [
  { id: 't1', origen: 'Quillota 980', destino: 'Santiago', trayecto: 'Ida', fecha: '2026-10-02', hora: '06:45', vanId: 'v1', reservados: 1, estado: 'pendiente' },
  { id: 't2', origen: 'Quillota 980', destino: 'Santiago', trayecto: 'Ida', fecha: '2026-10-28', hora: '06:45', vanId: 'v2', reservados: 1, estado: 'pendiente' },
  { id: 't3', origen: 'Santiago', destino: 'Quillota 980', trayecto: 'Vuelta', fecha: '2026-10-30', hora: '17:00', vanId: 'v1', reservados: 1, estado: 'pendiente' },
  { id: 't4', origen: 'Santiago', destino: 'Quillota 980', trayecto: 'Vuelta', fecha: '2026-10-02', hora: '17:00', vanId: 'v2', reservados: 1, estado: 'pendiente' },
]

export const adminInicial: Admin = {
  nombre: 'Admin Desarrollo',
  email: 'dev.admin@unab.cl',
  cargo: 'Administración de transporte',
  celular: '+56 9 0000 0001',
  ultimoIngreso: '2026-09-30T19:36',
}
