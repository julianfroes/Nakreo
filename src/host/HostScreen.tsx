import { useEffect } from 'react'
import { Button } from '../shared/components/Button'
import { navigate } from '../shared/useHashRoute'
import { Lobby } from './components/Lobby'
import { Mesa } from './components/Mesa'
import { useHost } from './hostStore'

/** Pantalla del anfitrión ("la mesa"): lobby con QR y, después, la vista pública de la partida. */
export function HostScreen() {
  const { snapshot, error, crearSala, cerrarSala } = useHost()

  useEffect(() => {
    void crearSala()
    return cerrarSala
  }, [crearSala, cerrarSala])

  if (error && !snapshot) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
        <p className="text-center text-rose-400">{error}</p>
        <Button onClick={() => void crearSala()}>Reintentar</Button>
        <Button variant="secondary" onClick={() => navigate('/')}>Volver</Button>
      </main>
    )
  }
  if (!snapshot) {
    return <main className="flex min-h-dvh items-center justify-center text-slate-400">Creando sala…</main>
  }
  return snapshot.iniciada && snapshot.mesa ? <Mesa s={snapshot} /> : <Lobby s={snapshot} />
}
