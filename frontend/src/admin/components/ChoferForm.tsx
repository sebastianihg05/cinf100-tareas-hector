import { useState, type FormEvent } from 'react'
import { useAdmin } from '../store/AdminContext'
import { nuevoId } from '../store/adminStore'
import type { Chofer } from '../types'
import { errorRut, esCorreoInstitucional, formatearRut, normalizarTelefono, todayISO } from '../utils/format'
import Field from './Field'
import { IconInfo } from './icons'

/** onSubmit puede devolver un mensaje de error (por ejemplo, si el backend rechazó el cambio). */
type Props = { initial?: Chofer; onSubmit: (chofer: Chofer) => void | Promise<string | void>; onCancel: () => void }
type Errors = Partial<Record<'nombre' | 'correo' | 'rut' | 'licencia' | 'telefono', string>>

export default function ChoferForm({ initial, onSubmit, onCancel }: Props) {
  const { state } = useAdmin()
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [correo, setCorreo] = useState(initial?.correo ?? '')
  const [telefono, setTelefono] = useState(initial?.telefono ?? '')
  const [rut, setRut] = useState(initial?.rut ?? '')
  const [licencia, setLicencia] = useState(initial?.licenciaHasta ?? '')
  const [errors, setErrors] = useState<Errors>({})
  const [errorGeneral, setErrorGeneral] = useState('')
  // nombre, correo y celular de un conductor de la base vienen de su cuenta
  const deCuenta = initial?.idBd !== undefined

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Errors = {}
    const nom = nombre.trim().replace(/\s+/g, ' ')
    if (nom.length < 3 || !/^[\p{L}\s'.-]+$/u.test(nom)) errs.nombre = 'Ingresa el nombre completo (solo letras)'

    const mail = correo.trim().toLowerCase()
    if (!esCorreoInstitucional(mail)) errs.correo = 'Usa el correo institucional (ej: nombre.apellido@unab.cl)'
    else if (state.choferes.some((c) => c.id !== initial?.id && c.correo.toLowerCase() === mail)) errs.correo = 'Ya existe un conductor con ese correo'

    const tel = normalizarTelefono(telefono)
    if (!tel) errs.telefono = 'Celular inválido. Ej: +56 9 1234 5678'

    const rutMalo = errorRut(rut)
    if (rutMalo) errs.rut = rutMalo
    else if (state.choferes.some((c) => c.id !== initial?.id && formatearRut(c.rut) === formatearRut(rut))) errs.rut = 'Ya existe un conductor con ese RUT'

    if (!licencia) errs.licencia = 'Indica cuándo vence la licencia'
    else if (licencia <= todayISO()) errs.licencia = 'La licencia debe estar vigente (fecha futura)'

    setErrors(errs)
    if (Object.keys(errs).length > 0 || !tel) return

    const error = await onSubmit({
      id: initial?.id ?? nuevoId('c'),
      idBd: initial?.idBd,
      nombre: nom,
      correo: mail,
      rut: formatearRut(rut),
      licenciaHasta: licencia,
      telefono: tel,
      activo: initial?.activo ?? true,
    })
    setErrorGeneral(typeof error === 'string' ? error : '')
  }

  return (
    <form className="adm-form" onSubmit={submit} noValidate>
      <p className="adm-note">
        <IconInfo size={16} />
        {deCuenta
          ? 'Nombre, correo y celular vienen de su cuenta. Aquí se completan el RUT y la licencia.'
          : 'Entrará con su cuenta institucional, sin contraseña propia.'}
      </p>

      <Field label="Nombre completo" error={errors.nombre}>
        {(p) => <input {...p} value={nombre} onChange={(e) => setNombre(e.target.value)} readOnly={deCuenta} autoComplete="off" />}
      </Field>

      <Field label="Correo" error={errors.correo}>
        {(p) => <input {...p} type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} readOnly={deCuenta} placeholder="nombre.apellido@unab.cl" autoComplete="off" />}
      </Field>

      <Field label="Celular" error={errors.telefono}>
        {(p) => <input {...p} type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} readOnly={deCuenta} placeholder="+56 9 1234 5678" />}
      </Field>

      <Field label="RUT" error={errors.rut} hint="Con o sin puntos y guion. Se puede cambiar cuando quieras.">
        {(p) => <input {...p} value={rut} onChange={(e) => setRut(e.target.value)} placeholder="12.345.678-5" autoComplete="off" />}
      </Field>

      <Field label="Vencimiento de la licencia" error={errors.licencia} hint="Se avisará en el panel antes de que venza.">
        {(p) => <input {...p} type="date" min={todayISO()} value={licencia} onChange={(e) => setLicencia(e.target.value)} />}
      </Field>

      <p className="adm-note"><IconInfo size={16} />La van se asigna desde Gestión de vans.</p>

      {errorGeneral && <p className="adm-field__error" role="alert">{errorGeneral}</p>}

      <div className="adm-form__actions">
        <button type="button" className="adm-btn adm-btn--ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="adm-btn adm-btn--primary">{initial ? 'Guardar cambios' : 'Agregar conductor'}</button>
      </div>
    </form>
  )
}
