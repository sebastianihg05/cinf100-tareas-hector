const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

const pad = (n: number) => String(n).padStart(2, '0')

export const parseISO = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Suma (o resta) días a una fecha yyyy-mm-dd */
export const sumarDias = (iso: string, dias: number) => {
  const d = parseISO(iso)
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Lunes de la semana de una fecha yyyy-mm-dd */
export const inicioSemana = (iso: string) => sumarDias(iso, -((parseISO(iso).getDay() + 6) % 7))

/** Ahora mismo, en hora local, como yyyy-mm-ddThh:mm */
export const ahoraISO = () => {
  const d = new Date()
  return `${todayISO()}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 2027-09-06 -> "6 de septiembre de 2027" */
export const fechaLarga = (iso: string) =>
  parseISO(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })

/** 2026-10-07 -> "7 oct" */
export const fechaCorta = (iso: string) => {
  const d = parseISO(iso)
  return `${d.getDate()} ${MESES[d.getMonth()]}`
}

/** 2026-10-07 -> "07/10/2026" */
export const fechaDMY = (iso: string) => iso.split('-').reverse().join('/')

/** 2026-09-30T19:36 -> "30 sept, 19:36" */
export const fechaHora = (iso: string) => `${fechaCorta(iso.slice(0, 10))}, ${iso.slice(11, 16)}`

export const iniciales = (nombre: string) =>
  nombre.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

/* ---------- RUT chileno ---------- */

const limpiarRut = (r: string) => r.replace(/[^0-9kK]/g, '').toUpperCase()

export function validarRut(r: string): boolean {
  const c = limpiarRut(r)
  if (c.length < 2) return false
  const cuerpo = c.slice(0, -1)
  const dv = c.slice(-1)
  if (!/^\d+$/.test(cuerpo)) return false
  let suma = 0
  let mult = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mult
    mult = mult === 7 ? 2 : mult + 1
  }
  const resto = 11 - (suma % 11)
  const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto)
  return dv === esperado
}

export function formatearRut(r: string): string {
  const c = limpiarRut(r)
  if (c.length < 2) return r
  const cuerpo = c.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${cuerpo}-${c.slice(-1)}`
}

/* ---------- Texto y correo ---------- */

/** minúsculas y sin tildes, para búsquedas */
export const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Solo correos institucionales (@unab.cl o @uandresbello.edu) */
export const esCorreoInstitucional = (c: string) => /^[^\s@]+@(unab\.cl|uandresbello\.edu)$/i.test(c.trim())

/** 0 = domingo ... 3 = miércoles, 4 = jueves */
export const diaSemana = (iso: string) => parseISO(iso).getDay()

/* ---------- Teléfono y patente ---------- */

/** Devuelve "+56 9 1234 5678" o null si no es un celular chileno válido */
export function normalizarTelefono(t: string): string | null {
  let n = t.replace(/\D/g, '')
  if (n.length === 11 && n.startsWith('56')) n = n.slice(2)
  if (n.length === 9 && n[0] === '9') return `+56 9 ${n.slice(1, 5)} ${n.slice(5)}`
  return null
}

/** Acepta AA-1234 (antigua) o BBCD-12 (nueva). Devuelve la patente con guion o null. */
export function normalizarPatente(p: string): string | null {
  const s = p.toUpperCase().replace(/[\s-]/g, '')
  if (/^[A-Z]{2}\d{4}$/.test(s)) return `${s.slice(0, 2)}-${s.slice(2)}`
  if (/^[A-Z]{4}\d{2}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4)}`
  return null
}
