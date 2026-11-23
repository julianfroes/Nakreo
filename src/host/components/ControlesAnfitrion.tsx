import { useEffect, useId, useRef, useState } from 'react'
import { MIN_JUGADORES } from '../../game/config'
import { Button } from '../../shared/components/Button'
import { navigate } from '../../shared/useHashRoute'
import type { SnapshotHost } from '../HostServidor'
import { useHost } from '../hostStore'

/** Fin de partida para el anfitrión que también juega: reiniciar, volver al lobby o cerrar. */
export function ControlesFin({ s }: { s: SnapshotHost }) {
  const { reiniciarPartida, volverAlLobby, cerrarSala, error } = useHost()
  const conectados = s.jugadores.filter((j) => j.conectado).length

  return (
    <div className="w-full space-y-3">
      {error && (
        <p role="alert" className="text-center text-rose-300">
          {error}
        </p>
      )}
      <Button disabled={conectados < MIN_JUGADORES} onClick={reiniciarPartida}>
        Jugar de nuevo
      </Button>
      <Button variant="secondary" onClick={volverAlLobby}>
        Volver al lobby
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          cerrarSala()
          navigate('/')
        }}
      >
        Cerrar sala
      </Button>
      <p className="text-center text-xs text-slate-500">
        «Jugar de nuevo» reparte cartas nuevas con los mismos jugadores conectados. «Volver al lobby» permite que
        entren jugadores nuevos.
      </p>
    </div>
  )
}

/**
 * Salir siendo el anfitrión = cerrar la sala para todos (el anfitrión es el
 * servidor de la partida). Con confirmación y un aviso claro; al cerrar, el host
 * avisa a cada jugador (`salaCerrada`) y la sesión termina de forma ordenada.
 */
export function CerrarSalaConfirmar({ etiqueta = 'Cerrar sala…' }: { etiqueta?: string }) {
  const cerrarSala = useHost((h) => h.cerrarSala)
  const [confirmando, setConfirmando] = useState(false)
  const quedarme = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (confirmando) quedarme.current?.focus() // el foco empieza en la opción segura
  }, [confirmando])

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300"
      >
        {etiqueta}
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
        ¿Cerrar la sala?
      </p>
      <p id={`${id}-aviso`} className="text-sm text-slate-200">
        Eres el anfitrión: si sales, la partida se cerrará para todos los jugadores y no podrá retomarse.
      </p>
      <Button variant="secondary" ref={quedarme} onClick={() => setConfirmando(false)}>
        Quedarme
      </Button>
      <Button
        variant="danger"
        onClick={() => {
          cerrarSala()
          navigate('/')
        }}
      >
        Sí, cerrar la sala para todos
      </Button>
    </div>
  )
}
