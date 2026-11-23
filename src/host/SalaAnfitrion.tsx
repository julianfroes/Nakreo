import { useEffect } from 'react'
import { Juego } from '../client/components/Juego'
import { useCliente } from '../client/store'
import { Button } from '../shared/components/Button'
import { navigate } from '../shared/useHashRoute'
import { CerrarSalaConfirmar, ControlesFin } from './components/ControlesAnfitrion'
import { Lobby } from './components/Lobby'
import { Mesa } from './components/Mesa'
import { obtenerHost, useHost } from './hostStore'

interface Props {
  /** false = sala sin roles especiales (máx. 6 jugadores). */
  especiales: boolean
  /** Si se indica, el anfitrión ocupa un asiento con este nombre desde el principio. */
  nombreInicial?: string | null
}

/**
 * Sala del anfitrión. El mismo navegador administra la sala y, según ocupe o no
 * un asiento, muestra una pantalla distinta durante la partida:
 *  - sin asiento («mesa»): la vista pública de la partida.
 *  - con asiento («anfitrión-jugador»): solo su proyección privada, NUNCA la vista
 *    general (si no, su mano quedaría a la vista de quien mire la pantalla).
 * Puede ocupar el asiento al crear la sala o después, antes de iniciar.
 */
export function SalaAnfitrion({ especiales, nombreInicial = null }: Props) {
  const { snapshot, error, crearSala, cerrarSala } = useHost()
  const proyeccion = useCliente((s) => s.proyeccion)

  useEffect(() => {
    // `vigente` evita unirse a una sala ya cerrada (StrictMode monta dos veces en desarrollo).
    let vigente = true
    void (async () => {
      await crearSala({ especiales })
      const host = obtenerHost()
      if (vigente && host && nombreInicial) await useCliente.getState().unirseLocal(host, nombreInicial)
    })()
    return () => {
      vigente = false
      useCliente.getState().salir()
      cerrarSala()
    }
  }, [crearSala, cerrarSala, especiales, nombreInicial])

  if (error && !snapshot) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
        <p className="text-center text-rose-400">{error}</p>
        <Button onClick={() => void crearSala({ especiales })}>Reintentar</Button>
        <Button variant="secondary" onClick={() => navigate('/')}>Volver</Button>
      </main>
    )
  }
  if (!snapshot) {
    return <main className="flex min-h-dvh items-center justify-center text-slate-400">Creando sala…</main>
  }

  const juego = snapshot.asientoLocal !== null
  if (snapshot.iniciada && juego && proyeccion) {
    return (
      <Juego
        p={proyeccion}
        modoAnfitrion
        menuAnfitrion={<CerrarSalaConfirmar etiqueta="Salir de la partida…" />}
        controlesFin={<ControlesFin s={snapshot} />}
      />
    )
  }
  if (snapshot.iniciada && !juego && snapshot.mesa) return <Mesa s={snapshot} />
  return <Lobby s={snapshot} />
}
