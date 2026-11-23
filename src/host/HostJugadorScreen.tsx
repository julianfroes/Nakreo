import { useState } from 'react'
import { MAX_NOMBRE } from '../shared/protocolo'
import { Button } from '../shared/components/Button'
import { navigate } from '../shared/useHashRoute'
import { InterruptorModo } from './components/InterruptorModo'
import { guardarNombre, leerNombre, useSinEspeciales } from './preferencias'
import { SalaAnfitrion } from './SalaAnfitrion'

/**
 * Anfitrión que también juega desde el principio. Este navegador administra la
 * sala pero su pantalla es la de un JUGADOR: ve solo su proyección privada,
 * nunca la vista general. Se une a su propia sala por una conexión local en
 * memoria, así que pasa por las mismas validaciones y proyecciones que un teléfono.
 */
export function HostJugadorScreen() {
  const [nombre, setNombre] = useState(leerNombre)
  const [empezar, setEmpezar] = useState(false)
  const [sinEspeciales, setSinEspeciales] = useSinEspeciales()

  if (empezar) return <SalaAnfitrion especiales={!sinEspeciales} nombreInicial={nombre.trim()} />

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-center text-3xl font-bold">Crear sala y jugar</h1>
      <p className="text-center text-slate-400">
        Administras la sala y juegas desde este dispositivo. Los demás se unen con el código o el QR.
      </p>
      <input
        className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-lg"
        placeholder="Tu nombre"
        value={nombre}
        maxLength={MAX_NOMBRE}
        autoComplete="nickname"
        onChange={(e) => setNombre(e.target.value)}
      />
      <InterruptorModo sinEspeciales={sinEspeciales} onCambio={setSinEspeciales} />
      <Button
        disabled={!nombre.trim()}
        onClick={() => {
          guardarNombre(nombre.trim())
          setEmpezar(true)
        }}
      >
        Crear sala
      </Button>
      <Button variant="secondary" onClick={() => navigate('/')}>Volver</Button>
    </main>
  )
}
