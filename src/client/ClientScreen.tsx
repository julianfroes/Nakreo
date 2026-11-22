import { useEffect } from 'react'
import { Button } from '../shared/components/Button'
import { useHashRoute } from '../shared/useHashRoute'
import { Juego } from './components/Juego'
import { Lobby, UnirseForm } from './components/Pantallas'
import { useCliente } from './store'

/**
 * Raíz del cliente móvil. Uso: #/join?room=ABCDE (el QR del anfitrión apunta ahí).
 * Si la pestaña se recarga en mitad de una partida, retoma la sesión guardada.
 */
export function ClientScreen() {
  const room = useHashRoute().params.get('room')
  const { conexion, proyeccion, sala, intento, retomarSesion, salir } = useCliente()

  useEffect(() => retomarSesion(room), [retomarSesion, room])

  if (conexion === 'inicio') return <UnirseForm codigoInicial={room ?? ''} />
  if (proyeccion) return <Juego p={proyeccion} />
  if (sala) return <Lobby />
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 p-6 text-slate-400">
      <p>{conexion === 'reconectando' ? `Conexión perdida. Reconectando… (intento ${intento})` : 'Conectando…'}</p>
      <Button variant="secondary" onClick={salir}>Cancelar</Button>
    </main>
  )
}
