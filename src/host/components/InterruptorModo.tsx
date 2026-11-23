import { useId } from 'react'
import { describirModo } from '../../shared/reglasContenido'

interface Props {
  /** true = «Jugar sin roles especiales» activado. */
  sinEspeciales: boolean
  onCambio: (sinEspeciales: boolean) => void
  deshabilitado?: boolean
  /** Aviso bajo el interruptor (p. ej. por qué el host rechazó el cambio). */
  aviso?: string | null
}

/**
 * Interruptor «Jugar sin roles especiales». Accesible: rol `switch`, nombre y
 * descripción enlazados, foco visible y zona táctil de al menos 44 px.
 * Muestra siempre el aforo del modo elegido.
 */
export function InterruptorModo({ sinEspeciales, onCambio, deshabilitado, aviso }: Props) {
  const id = useId()
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-left">
      <div className="flex items-center justify-between gap-4">
        <span id={`${id}-nombre`} className="text-lg font-semibold">
          Jugar sin roles especiales
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={sinEspeciales}
          aria-labelledby={`${id}-nombre`}
          aria-describedby={`${id}-descripcion`}
          disabled={deshabilitado}
          onClick={() => onCambio(!sinEspeciales)}
          className={`relative h-11 w-[4.5rem] shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 ${
            sinEspeciales ? 'bg-cyan-500' : 'bg-slate-600'
          }`}
        >
          <span
            aria-hidden
            className={`absolute left-1.5 top-1.5 h-8 w-8 rounded-full bg-white transition-transform motion-reduce:transition-none ${
              sinEspeciales ? 'translate-x-7' : ''
            }`}
          />
        </button>
      </div>
      <p id={`${id}-descripcion`} className="mt-2 text-sm text-slate-300">
        {describirModo(!sinEspeciales)}
      </p>
      {aviso && (
        <p role="alert" className="mt-2 text-sm text-rose-300">
          {aviso}
        </p>
      )}
    </div>
  )
}
