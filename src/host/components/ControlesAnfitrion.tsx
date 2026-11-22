import { useState } from 'react'
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

/** Cerrar la sala en mitad de la partida (con confirmación: afecta a todos los jugadores). */
export function CerrarSalaConfirmar() {
  const cerrarSala = useHost((h) => h.cerrarSala)
  const [confirmando, setConfirmando] = useState(false)

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400"
      >
        Cerrar sala…
      </button>
    )
  }
  return (
    <div role="alertdialog" className="space-y-2 rounded-xl border border-rose-700 bg-rose-950/50 p-3 text-center">
      <p className="text-sm">¿Cerrar la sala? La partida terminará para todos los jugadores.</p>
      <div className="flex gap-2">
        <Button
          variant="danger"
          onClick={() => {
            cerrarSala()
            navigate('/')
          }}
        >
          Cerrar sala
        </Button>
        <Button variant="secondary" onClick={() => setConfirmando(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
