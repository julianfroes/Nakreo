import { useId, useMemo, useState } from 'react'
import type { EstadoProyectado } from '../../game/proyeccion'
import { PanelReglas } from '../../shared/components/PanelReglas'
import { calcularDescarte } from '../descarte'
import { ListaDescarte } from './Descarte'

const boton =
  'min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-base font-semibold text-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300 active:bg-slate-800'

/**
 * Consultas durante la partida, en la zona secundaria (lejos de las acciones):
 *  - «Guía rápida»: panel superpuesto con las acciones y los roles.
 *  - «Descarte (n)»: plegable con las cartas perdidas de todos, en tiempo real.
 * Ninguna de las dos altera la partida, que sigue actualizándose por detrás.
 */
export function HerramientasPartida({ p, urgente }: { p: EstadoProyectado; urgente: boolean }) {
  const [guia, setGuia] = useState(false)
  const [descarteAbierto, setDescarteAbierto] = useState(false)
  const idDescarte = useId()
  const descarte = useMemo(() => calcularDescarte(p), [p])

  // Una decisión urgente (te desafían, debes perder una carta...) tiene prioridad sobre la guía:
  // se cierra y no reaparece sola cuando la decisión termina.
  const [urgentePrevio, setUrgentePrevio] = useState(urgente)
  if (urgente !== urgentePrevio) {
    setUrgentePrevio(urgente)
    if (urgente) setGuia(false)
  }

  return (
    <section aria-label="Consultas" className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={boton} onClick={() => setGuia(true)}>
          <span aria-hidden>📖</span> Guía rápida
        </button>
        <button
          type="button"
          className={boton}
          aria-expanded={descarteAbierto}
          aria-controls={idDescarte}
          onClick={() => setDescarteAbierto((a) => !a)}
        >
          Descarte ({descarte.total}) <span aria-hidden>{descarteAbierto ? '▴' : '▾'}</span>
        </button>
      </div>
      <div
        id={idDescarte}
        role="region"
        aria-label="Descarte"
        hidden={!descarteAbierto}
        className="rounded-xl border border-slate-700 bg-slate-900 p-3"
      >
        <ListaDescarte descarte={descarte} yo={p.yo.id} />
      </div>
      <PanelReglas abierto={guia && !urgente} onCerrar={() => setGuia(false)} modo="guia" especiales={p.especiales} />
    </section>
  )
}
