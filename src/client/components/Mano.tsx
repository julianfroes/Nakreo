import { useState } from 'react'
import type { CartaEnMano } from '../../game/types'
import { CartaRol } from './CartaRol'

/** Mis cartas. El botón de ocultar las tapa por si hay alguien mirando la pantalla. */
export function Mano({ mano }: { mano: CartaEnMano[] }) {
  const [oculta, setOculta] = useState(false)
  return (
    <section className="px-4 py-3">
      <div className="mb-2 flex items-center justify-between text-sm text-slate-400">
        <span>Tus cartas (solo tú las ves)</span>
        <button
          type="button"
          onClick={() => setOculta((o) => !o)}
          className="rounded-lg border border-slate-700 px-3 py-1"
        >
          {oculta ? 'Mostrar' : 'Ocultar'}
        </button>
      </div>
      <div className="flex gap-3">
        {mano.map((c) => (
          <CartaRol key={c.id} rol={c.rol} perdida={c.revelada} oculta={oculta && !c.revelada} />
        ))}
      </div>
    </section>
  )
}
