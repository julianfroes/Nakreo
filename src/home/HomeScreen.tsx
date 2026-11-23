import { useState } from 'react'
import { Button } from '../shared/components/Button'
import { PanelReglas } from '../shared/components/PanelReglas'
import { navigate } from '../shared/useHashRoute'

export function HomeScreen() {
  const [reglas, setReglas] = useState(false)
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="mb-8 text-center text-5xl font-bold tracking-tight">Nakreo</h1>
      <Button onClick={() => navigate('/host')}>Crear sala</Button>
      <Button variant="secondary" onClick={() => navigate('/host?jugar=1')}>
        Crear sala y jugar
      </Button>
      <Button variant="secondary" onClick={() => navigate('/join')}>
        Unirme
      </Button>
      <Button variant="secondary" onClick={() => setReglas(true)}>
        <span aria-hidden>📖</span> Reglas
      </Button>
      <PanelReglas abierto={reglas} onCerrar={() => setReglas(false)} modo="reglas" />
    </main>
  )
}
