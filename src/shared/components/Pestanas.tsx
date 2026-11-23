import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export interface Pestana {
  id: string
  etiqueta: string
  contenido: ReactNode
}

/**
 * Pestañas accesibles (patrón ARIA «tabs»): flechas, Inicio y Fin cambian de
 * pestaña, solo la activa entra en el orden del Tab y cada panel está enlazado.
 */
export function Pestanas({
  pestanas,
  nombre,
  inicial,
}: {
  pestanas: Pestana[]
  /** Nombre accesible del grupo de pestañas. */
  nombre: string
  inicial?: string
}) {
  const [activa, setActiva] = useState(inicial ?? pestanas[0].id)
  const base = useId()
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  const alTecla = (e: KeyboardEvent, i: number) => {
    const n = pestanas.length
    const destino =
      e.key === 'ArrowRight' ? (i + 1) % n
      : e.key === 'ArrowLeft' ? (i - 1 + n) % n
      : e.key === 'Home' ? 0
      : e.key === 'End' ? n - 1
      : null
    if (destino === null) return
    e.preventDefault()
    setActiva(pestanas[destino].id)
    refs.current[pestanas[destino].id]?.focus()
  }

  return (
    <div>
      <div role="tablist" aria-label={nombre} className="flex gap-1 rounded-xl bg-slate-800 p-1">
        {pestanas.map((p, i) => (
          <button
            key={p.id}
            ref={(el) => {
              refs.current[p.id] = el
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${p.id}`}
            aria-selected={activa === p.id}
            aria-controls={`${base}-panel-${p.id}`}
            tabIndex={activa === p.id ? 0 : -1}
            onClick={() => setActiva(p.id)}
            onKeyDown={(e) => alTecla(e, i)}
            className={`min-h-11 flex-1 rounded-lg px-3 text-base font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300 ${
              activa === p.id ? 'bg-cyan-500 text-slate-950' : 'text-slate-200 hover:bg-slate-700'
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>
      {pestanas.map((p) => (
        <div
          key={p.id}
          role="tabpanel"
          id={`${base}-panel-${p.id}`}
          aria-labelledby={`${base}-tab-${p.id}`}
          hidden={activa !== p.id}
          tabIndex={0}
          className="pt-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300"
        >
          {activa === p.id && p.contenido}
        </div>
      ))}
    </div>
  )
}
