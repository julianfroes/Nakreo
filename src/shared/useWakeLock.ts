import { useEffect } from 'react'

/**
 * Mantiene la pantalla encendida mientras `activo` sea true (Screen Wake Lock API).
 * Un móvil que se bloquea suspende la pestaña y corta la conexión; en el
 * anfitrión eso termina la partida para todos. El navegador libera el bloqueo al
 * ocultarse la pestaña, así que se vuelve a pedir al regresar.
 *
 * Requiere contexto seguro (HTTPS o localhost); si no hay soporte, no hace nada.
 */
export function usePantallaEncendida(activo: boolean) {
  useEffect(() => {
    if (!activo || !('wakeLock' in navigator)) return
    let sentinela: WakeLockSentinel | null = null
    let cancelado = false

    const pedir = async () => {
      try {
        const s = await navigator.wakeLock.request('screen')
        if (cancelado) void s.release()
        else sentinela = s
      } catch {
        // Sin permiso (p. ej. ahorro de batería): se sigue sin bloqueo.
      }
    }
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') void pedir()
    }

    void pedir()
    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    return () => {
      cancelado = true
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      void sentinela?.release()
    }
  }, [activo])
}
