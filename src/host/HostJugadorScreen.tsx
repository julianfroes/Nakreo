import { useEffect, useState } from 'react'
import { Juego } from '../client/components/Juego'
import { useCliente } from '../client/store'
import { MAX_NOMBRE } from '../shared/protocolo'
import { Button } from '../shared/components/Button'
import { navigate } from '../shared/useHashRoute'
import { CerrarSalaConfirmar, ControlesFin } from './components/ControlesAnfitrion'
import { Lobby } from './components/Lobby'
import { obtenerHost, useHost } from './hostStore'

const CLAVE_NOMBRE = 'nakreo-nombre'

/**
 * Anfitrión que también juega. Este navegador administra la sala (como la mesa)
 * pero su pantalla es la de un JUGADOR: ve solo su proyección privada, nunca la
 * vista general. Se une a su propia sala por una conexión local en memoria, así
 * que pasa por las mismas validaciones y proyecciones que cualquier teléfono.
 */
export function HostJugadorScreen() {
  const [nombre, setNombre] = useState(() => localStorage.getItem(CLAVE_NOMBRE) ?? '')
  const [empezar, setEmpezar] = useState(false)

  if (empezar) return <SalaJugador nombre={nombre.trim()} />

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
      <Button
        disabled={!nombre.trim()}
        onClick={() => {
          localStorage.setItem(CLAVE_NOMBRE, nombre.trim())
          setEmpezar(true)
        }}
      >
        Crear sala
      </Button>
      <Button variant="secondary" onClick={() => navigate('/')}>Volver</Button>
    </main>
  )
}

function SalaJugador({ nombre }: { nombre: string }) {
  const { snapshot, error, crearSala, cerrarSala } = useHost()
  const proyeccion = useCliente((s) => s.proyeccion)

  useEffect(() => {
    // `vigente` evita unirse a una sala ya cerrada (StrictMode monta dos veces en desarrollo).
    let vigente = true
    void (async () => {
      await crearSala()
      const host = obtenerHost()
      if (vigente && host) await useCliente.getState().unirseLocal(host, nombre)
    })()
    return () => {
      vigente = false
      useCliente.getState().salir()
      cerrarSala()
    }
  }, [crearSala, cerrarSala, nombre])

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
  // Partida en curso: solo la vista de jugador (proyección privada), nunca la mesa general.
  if (snapshot.iniciada && proyeccion) {
    return (
      <Juego
        p={proyeccion}
        modoAnfitrion
        menuAnfitrion={<CerrarSalaConfirmar />}
        controlesFin={<ControlesFin s={snapshot} />}
      />
    )
  }
  return <Lobby s={snapshot} />
}
