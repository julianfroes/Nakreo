import { useId, useRef, type ReactNode } from 'react'
import { useDialogo } from '../useDialogo'
import { Button } from './Button'

interface Props {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  children: ReactNode
  /** Texto del botón grande de cierre. */
  cerrar?: string
}

/**
 * Panel superpuesto para consultar información sin perder el estado de la
 * pantalla de abajo. En móvil sale desde abajo (hoja inferior) y su botón
 * «Cerrar» queda al alcance del pulgar; en escritorio es un diálogo centrado.
 * Se cierra con un toque fuera, con Escape, con la «✕» o con «Cerrar».
 */
export function PanelSuperpuesto({ abierto, onCerrar, titulo, children, cerrar = 'Cerrar' }: Props) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  useDialogo(abierto, onCerrar, panel)
  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center md:p-6">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onCerrar} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        tabIndex={-1}
        className="relative flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-t-3xl border border-slate-700 bg-slate-900 shadow-2xl animate-entrada focus:outline-none md:rounded-3xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-700 px-5 py-3">
          <h2 id={`${id}-titulo`} className="text-xl font-bold">
            {titulo}
          </h2>
          <button
            type="button"
            aria-label="Cerrar panel"
            onClick={onCerrar}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-slate-600 text-lg text-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300"
          >
            <span aria-hidden>✕</span>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        <footer className="border-t border-slate-700 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button variant="secondary" onClick={onCerrar}>
            {cerrar}
          </Button>
        </footer>
      </div>
    </div>
  )
}
