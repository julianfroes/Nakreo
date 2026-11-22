import { Button } from '../shared/components/Button'
import { navigate } from '../shared/useHashRoute'

export function HomeScreen() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="mb-8 text-center text-5xl font-bold tracking-tight">Nakreo</h1>
      <Button onClick={() => navigate('/host')}>Crear sala</Button>
      <Button variant="secondary" onClick={() => navigate('/join')}>
        Unirme
      </Button>
    </main>
  )
}
