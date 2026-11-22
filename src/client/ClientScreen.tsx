import { useEffect } from 'react'
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
  const { conexion, proyeccion, sala, intento, retomarSesion } = useCliente()

  useEffect(() => retomarSesion(room), [retomarSesion, room])

  if (conexion === 'inicio') return <UnirseForm codigoInicial={room ?? ''} />
  if (proyeccion) return <Juego p={proyeccion} />
  if (sala) return <Lobby />
  return (
    <main className="flex min-h-dvh items-center justify-center p-6 text-slate-400">
      {conexion === 'reconectando' ? `Conexión perdida. Reconectando… (intento ${intento})` : 'Conectando…'}
    </main>
  )
}
