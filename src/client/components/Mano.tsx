import { useState } from 'react'
import type { CartaEnMano } from '../../game/types'
import { CartaRol } from './CartaRol'

/** Mis cartas. El botón de ocultar las tapa por si hay alguien mirando la pantalla. */
export function Mano({ mano }: { mano: CartaEnMano[] }) {
  const [oculta, setOculta] = useState(false)
  return (
    <section className="px-4 py-3 lg:px-0 lg:py-0">
      <div className="mb-2 flex items-center justify-between text-sm text-slate-400 lg:mb-3 lg:text-base">
        <span>Tus cartas (solo tú las ves)</span>
        <button
          type="button"
          onClick={() => setOculta((o) => !o)}
          className="rounded-lg border border-slate-700 px-3 py-1"
        >
          {oculta ? 'Mostrar' : 'Ocultar'}
        </button>
      </div>
      <div className="flex gap-3 lg:mx-auto lg:max-w-xl lg:gap-5">
        {mano.map((c) => (
          <CartaRol key={c.id} rol={c.rol} especial={c.especial} perdida={c.revelada} oculta={oculta && !c.revelada} />
        ))}
      </div>
    </section>
  )
}
