import type { Rol } from '../../game/types'
import { ROL_UI } from '../../shared/rolesUI'

interface Props {
  rol: Rol
  /** Carta perdida (boca arriba para todos). */
  perdida?: boolean
  oculta?: boolean
  seleccionada?: boolean
  onClick?: () => void
}

/** Una carta de rol: icono, nombre y descripción breve. */
export function CartaRol({ rol, perdida, oculta, seleccionada, onClick }: Props) {
  const ui = ROL_UI[rol]
  const interactiva = !!onClick && !perdida
  const clases = [
    'flex min-h-48 flex-1 flex-col items-center gap-2 rounded-2xl border-2 bg-gradient-to-b p-3 text-center transition-all',
    oculta ? 'border-slate-600 from-slate-800 to-slate-900' : `${ui.borde} ${ui.fondo}`,
    perdida ? 'opacity-40 grayscale' : '',
    seleccionada ? 'scale-105 ring-4 ring-cyan-400' : '',
    interactiva ? 'cursor-pointer active:scale-95' : '',
  ].join(' ')

  const contenido = oculta ? (
    <span className="m-auto text-5xl" aria-label="Carta oculta">🂠</span>
  ) : (
    <>
      <span className="text-5xl" aria-hidden>{ui.icono}</span>
      <span className="text-base font-bold leading-tight">{ui.nombre}</span>
      <span className="text-xs leading-snug text-slate-300">{ui.descripcion}</span>
      {perdida && (
        <span className="mt-auto rounded bg-slate-950/70 px-2 py-0.5 text-xs font-semibold uppercase">
          Perdida
        </span>
      )}
    </>
  )

  return interactiva ? (
    <button type="button" className={clases} onClick={onClick} aria-pressed={seleccionada}>
      {contenido}
    </button>
  ) : (
    <div className={clases}>{contenido}</div>
  )
}
