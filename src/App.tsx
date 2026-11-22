import { lazy, Suspense } from 'react'
import { ClientScreen } from './client/ClientScreen'
import { HomeScreen } from './home/HomeScreen'
import { HostScreen } from './host/HostScreen'
import { useHashRoute } from './shared/useHashRoute'

// Galería de pantallas para revisión visual. `import.meta.env.DEV` es false en
// producción, así que Vite elimina este import y la galería no se publica.
const Galeria = import.meta.env.DEV ? lazy(() => import('./dev/Galeria')) : null

export default function App() {
  const { path } = useHashRoute()
  switch (path) {
    case '/host':
      return <HostScreen />
    case '/join':
      return <ClientScreen />
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
