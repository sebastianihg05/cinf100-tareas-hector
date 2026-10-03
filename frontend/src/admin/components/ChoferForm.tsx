import { useState, type FormEvent } from 'react'
import { useAdmin } from '../store/AdminContext'
import { nuevoId } from '../store/adminStore'
import type { Chofer } from '../types'
import { esCorreoInstitucional, formatearRut, normalizarTelefono, todayISO, validarRut } from '../utils/format'
import Field from './Field'
import { IconInfo } from './icons'

type Props = { initial?: Chofer; onSubmit: (chofer: Chofer) => void; onCancel: () => void }
type Errors = Partial<Record<'nombre' | 'correo' | 'rut' | 'licencia' | 'telefono', string>>

export default function ChoferForm({ initial, onSubmit, onCancel }: Props) {
  const { state } = useAdmin()
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [correo, setCorreo] = useState(initial?.correo ?? '')
  const [telefono, setTelefono] = useState(initial?.telefono ?? '')
  const [rut, setRut] = useState(initial?.rut ?? '')
  const [licencia, setLicencia] = useState(initial?.licenciaHasta ?? '')
  const [errors, setErrors] = useState<Errors>({})

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Errors = {}
    const nom = nombre.trim().replace(/\s+/g, ' ')
    if (nom.length < 3 || !/^[\p{L}\s'.-]+$/u.test(nom)) errs.nombre = 'Ingresa el nombre completo (solo letras)'

    const mail = correo.trim().toLowerCase()
    if (!esCorreoInstitucional(mail)) errs.correo = 'Usa el correo institucional (ej: nombre.apellido@unab.cl)'
    else if (state.choferes.some((c) => c.id !== initial?.id && c.correo.toLowerCase() === mail)) errs.correo = 'Ya existe un conductor con ese correo'

    const tel = normalizarTelefono(telefono)
    if (!tel) errs.telefono = 'Celular inválido. Ej: +56 9 1234 5678'

    if (!validarRut(rut)) errs.rut = 'RUT inválido. Ej: 12.345.678-5'
    else if (state.choferes.some((c) => c.id !== initial?.id && formatearRut(c.rut) === formatearRut(rut))) errs.rut = 'Ya existe un conductor con ese RUT'

    if (!licencia) errs.licencia = 'Indica cuándo vence la licencia'
    else if (licencia <= todayISO()) errs.licencia = 'La licencia debe estar vigente (fecha futura)'

    setErrors(errs)
    if (Object.keys(errs).length > 0 || !tel) return

    onSubmit({
      id: initial?.id ?? nuevoId('c'),
      nombre: nom,
      correo: mail,
      rut: formatearRut(rut),
      licenciaHasta: licencia,
      telefono: tel,
      activo: initial?.activo ?? true,
    })
  }

  return (
    <form className="adm-form" onSubmit={submit} noValidate>
      <p className="adm-note"><IconInfo size={16} />Entrará con su cuenta institucional, sin contraseña propia.</p>

      <Field label="Nombre completo" error={errors.nombre}>
        {(p) => <input {...p} value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" />}
      </Field>

      <Field label="Correo" error={errors.correo}>
        {(p) => <input {...p} type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre.apellido@unab.cl" autoComplete="off" />}
      </Field>

      <Field label="Celular" error={errors.telefono}>
        {(p) => <input {...p} type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+56 9 1234 5678" />}
      </Field>

      <Field label="RUT" error={errors.rut} hint="Se valida el dígito verificador.">
        {(p) => <input {...p} value={rut} onChange={(e) => setRut(e.target.value)} placeholder="12.345.678-5" autoComplete="off" />}
      </Field>

      <Field label="Vencimiento de la licencia" error={errors.licencia} hint="Se avisará en el panel antes de que venza.">
        {(p) => <input {...p} type="date" min={todayISO()} value={licencia} onChange={(e) => setLicencia(e.target.value)} />}
      </Field>

      <p className="adm-note"><IconInfo size={16} />La van se asigna desde Gestión de vans.</p>

      <div className="adm-form__actions">
        <button type="button" className="adm-btn adm-btn--ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="adm-btn adm-btn--primary">{initial ? 'Guardar cambios' : 'Agregar conductor'}</button>
      </div>
    </form>
  )
}
