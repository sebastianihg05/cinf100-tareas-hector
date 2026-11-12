import { useState } from 'react'
import '../admin/components/Indicador.css'
import AnimatedContent from './AnimatedContent'
import ClickSpark from './ClickSpark'
import Counter from './Counter'
import FadeContent from './FadeContent'
import GlareHover from './GlareHover'
import HoldButton from './HoldButton'
import LatticeLoader from './LatticeLoader'
import ShinyText from './ShinyText'
import SloshGauge from './SloshGauge'
import StarBorder from './StarBorder'
import TextType from './TextType'
import Waves from './Waves'
import { UNAB } from './unab'

const datos = [
  { etiqueta: 'Usuarios activos', valor: 128, tono: 'navy' },
  { etiqueta: 'Conductores', valor: 12, tono: 'blue' },
  { etiqueta: 'Vans activas', valor: 6, tono: 'turquoise' },
  { etiqueta: 'Pendientes', valor: 9, tono: 'yellow' },
]
const titulo = { fontSize: 13, color: 'var(--muted)', margin: '22px 0 8px' }

/**
 * Muestra de los 12 componentes de React Bits con los colores UNAB (RB-03).
 * Solo existe en desarrollo: /demo-animaciones. Sirve de referencia de uso para RB-04 y RB-05.
 */
export default function DemoReactBits() {
  const [n, setN] = useState(0)
  const [enCurso, setEnCurso] = useState(false)
  return (
    <div className="adm-shell">
      <header className="adm-header" style={{ position: 'relative', overflow: 'hidden', minHeight: 84 }}>
        <Waves lineColor="rgba(255,255,255,.28)" backgroundColor={UNAB.navy} accentColor={UNAB.rojo} style={{ position: 'absolute', inset: 0 }} />
        <h1 className="adm-title" style={{ position: 'relative' }}>
          <TextType text="Hola, Administrador" typingSpeed={55} loop={false} showCursor={false} />
        </h1>
      </header>
      <main className="adm-content">
        <h2 style={titulo}>Indicadores: AnimatedContent + Counter</h2>
        <AnimatedContent key={n} distance={28} duration={0.55} stagger={0.09} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {datos.map((d) => (
            <div key={d.etiqueta} className={`indicador indicador--tarjeta indicador--${d.tono}`}>
              <span className="indicador__etiqueta">{d.etiqueta}</span>
              <strong className="indicador__valor"><Counter value={d.valor + n} fontSize={26} fontWeight={800} textColor="currentColor" /></strong>
            </div>
          ))}
        </AnimatedContent>
        <button type="button" className="adm-add" style={{ marginTop: 10 }} onClick={() => setN(n + 7)}>Repetir animación</button>

        <h2 style={titulo}>Ocupación: SloshGauge + GlareHover</h2>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <SloshGauge value={75} liquidColor={UNAB.navy} width={84} height={120} unit="%" ariaLabel="Ocupación: 6 de 8 asientos" />
          <GlareHover width="100%" height="auto" background={UNAB.navy} borderRadius="12px" borderColor="transparent" glareColor={UNAB.blanco} glareOpacity={0.35}>
            <div className="adm-card" style={{ width: '100%', boxShadow: 'none' }}>
              <p className="adm-card__title">Van ABCD-12</p>
              <p className="adm-card__small">Hyundai Staria · 6/8 asientos</p>
            </div>
          </GlareHover>
        </div>

        <h2 style={titulo}>Viaje del conductor: HoldButton + FadeContent</h2>
        <FadeContent key={String(enCurso)} trigger="mount" blur duration={0.5}>
          <div className="psj-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span className={`psj-badge${enCurso ? ' psj-badge--activo' : ''}`}>{enCurso ? 'En curso' : 'Pendiente'}</span>
            <HoldButton backgroundColor={UNAB.navy} fillColor={UNAB.rojo} textColor={UNAB.blanco} fillTextColor={UNAB.blanco} holdTime={900}
              doneLabel="Listo" onHold={() => setEnCurso(!enCurso)}>
              {enCurso ? 'Mantén para finalizar' : 'Mantén para iniciar'}
            </HoldButton>
          </div>
        </FadeContent>

        <h2 style={titulo}>Reserva: ShinyText + StarBorder + ClickSpark</h2>
        <p className="psj-exito__title" style={{ textAlign: 'center' }}>
          <ShinyText text="¡Reserva Confirmada!" color={UNAB.navy} shineColor={UNAB.navyClaro} speed={2.5} />
        </p>
        {/* ClickSpark ocupa el 100 % del alto de su contenedor si no se le indica otra cosa */}
        <ClickSpark sparkColor={[UNAB.rojo, UNAB.navy]} sparkCount={12} sparkRadius={34} shape="star" style={{ height: 'auto' }}>
          <StarBorder color={UNAB.rojo} trailColor={UNAB.blanco} backgroundColor={UNAB.navy} textColor={UNAB.blanco} radius={10} style={{ width: '100%' }}>
            Seleccionar asientos
          </StarBorder>
        </ClickSpark>

        <h2 style={titulo}>Carga: LatticeLoader</h2>
        <LatticeLoader label="Cargando viajes" pattern="ripple" color={UNAB.navy} />
      </main>
    </div>
  )
}
