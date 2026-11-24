import { lazy, Suspense } from 'react'
import { ClientScreen } from './client/ClientScreen'
import { HomeScreen } from './home/HomeScreen'
import { HostJugadorScreen } from './host/HostJugadorScreen'
import { HostScreen } from './host/HostScreen'
import { ContenidoGaleria } from './shared/components/GaleriaCartas'
import { Button } from './shared/components/Button'
import { navigate, useHashRoute } from './shared/useHashRoute'
import { usePantallaEncendida } from './shared/useWakeLock'

// Galería de pantallas para revisión visual. `import.meta.env.DEV` es false en
// producción, así que Vite elimina este import y la galería no se publica.
const Galeria = import.meta.env.DEV ? lazy(() => import('./dev/Galeria')) : null

export default function App() {
  const { path, params } = useHashRoute()
  // Un móvil que se bloquea corta la conexión (y si es el anfitrión, la partida de todos).
  usePantallaEncendida(path === '/host' || path === '/join')

  switch (path) {
    case '/host':
      return params.get('jugar') ? <HostJugadorScreen /> : <HostScreen />
    case '/join':
      return <ClientScreen />
    case '/cartas': // galería oculta: sin enlaces, solo por URL
      return (
        <main className="mx-auto min-h-dvh max-w-2xl space-y-4 p-6">
          <h1 className="text-3xl font-bold">Cartas</h1>
          <ContenidoGaleria />
          <Button variant="secondary" onClick={() => navigate('/')}>← Volver al inicio</Button>
        </main>
      )
    case '/dev':
      return Galeria ? (
        <Suspense fallback={null}>
          <Galeria />
        </Suspense>
      ) : (
        <HomeScreen />
      )
    default:
      return <HomeScreen />
  }
}
