import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../shared/components/Button'
import { useCliente } from '../store'

/**
 * «Salir de la partida» para un jugador. Está en la zona secundaria (bajo las
 * cartas), lejos de las acciones de juego, y exige una confirmación explícita:
 * salir es definitivo.
 */
export function SalirConfirmar() {
  const abandonar = useCliente((s) => s.abandonar)
  const saliendo = useCliente((s) => s.saliendo)
  const [confirmando, setConfirmando] = useState(false)
  const quedarme = useRef<HTMLButtonElement>(null)
  const id = useId()

  // El foco empieza en la opción segura.
  useEffect(() => {
    if (confirmando) quedarme.current?.focus()
  }, [confirmando])

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300"
      >
        Salir de la partida…
      </button>
    )
  }
  return (
    <div
      role="alertdialog"
      aria-labelledby={`${id}-titulo`}
      aria-describedby={`${id}-aviso`}
      onKeyDown={(e) => e.key === 'Escape' && setConfirmando(false)}
      className="space-y-3 rounded-xl border border-rose-700 bg-rose-950/50 p-3 text-center"
    >
      <p id={`${id}-titulo`} className="font-semibold">
        ¿Salir de la partida?
      </p>
      <p id={`${id}-aviso`} className="text-sm text-slate-200">
        Si sales no podrás reingresar a esta partida. Perderás tus vidas y, si tenías una acción pendiente, el
        turno continuará.
      </p>
      <Button variant="secondary" ref={quedarme} disabled={saliendo} onClick={() => setConfirmando(false)}>
        Quedarme
      </Button>
      <Button variant="danger" disabled={saliendo} onClick={abandonar}>
        {saliendo ? 'Saliendo…' : 'Sí, salir de la partida'}
      </Button>
    </div>
  )
}
