import { useState } from 'react'
import { Button } from '../shared/components/Button'
import { navigate } from '../shared/useHashRoute'
import { InterruptorModo } from './components/InterruptorModo'
import { useSinEspeciales } from './preferencias'
import { SalaAnfitrion } from './SalaAnfitrion'

/**
 * Pantalla del anfitrión («la mesa»): primero se configura la sala (modo de
 * juego); después, lobby con QR y, al iniciar, la vista pública de la partida.
 * Desde el lobby el anfitrión puede ocupar un asiento si quiere jugar.
 */
export function HostScreen() {
  const [sinEspeciales, setSinEspeciales] = useSinEspeciales()
  const [creando, setCreando] = useState(false)

  if (!creando) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
        <h1 className="text-center text-3xl font-bold">Crear sala</h1>
        <p className="text-center text-slate-400">
          Esta pantalla es la mesa: muestra la partida a todos. Los jugadores se unen con el código o el QR.
        </p>
        <InterruptorModo sinEspeciales={sinEspeciales} onCambio={setSinEspeciales} />
        <Button onClick={() => setCreando(true)}>Crear sala</Button>
        <Button variant="secondary" onClick={() => navigate('/')}>Volver</Button>
      </main>
    )
  }
  return <SalaAnfitrion especiales={!sinEspeciales} />
}
