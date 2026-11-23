import type { ReactNode } from 'react'

/** Panel a pantalla completa para decisiones que no se pueden ignorar. */
export function Overlay({
  titulo,
  subtitulo,
  alerta,
  children,
}: {
  titulo: string
  subtitulo?: string
  /** Estilo urgente (sacudida y borde rojo), p. ej. al ser desafiado. */
  alerta?: boolean
  children: ReactNode
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/95 p-4 backdrop-blur-sm"
    >
      <div
        className={`mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 animate-entrada lg:max-w-3xl ${
          alerta ? 'animate-sacudida' : ''
        }`}
      >
        <header className={`rounded-2xl border-2 p-4 text-center ${alerta ? 'border-rose-500 bg-rose-950/60' : 'border-cyan-500 bg-slate-900'}`}>
          <h2 className="text-2xl font-bold">{titulo}</h2>
          {subtitulo && <p className="mt-1 text-slate-300">{subtitulo}</p>}
        </header>
        {children}
      </div>
    </div>
  )
}
