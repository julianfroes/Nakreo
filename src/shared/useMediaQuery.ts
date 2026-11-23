import { useCallback, useSyncExternalStore } from 'react'

/** ¿Coincide ahora la consulta de medios? Se actualiza sola al redimensionar la ventana. */
export function useMediaQuery(consulta: string): boolean {
  const suscribir = useCallback(
    (aviso: () => void) => {
      const lista = window.matchMedia(consulta)
      lista.addEventListener('change', aviso)
      return () => lista.removeEventListener('change', aviso)
    },
    [consulta],
  )
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(consulta).matches,
    () => false,
  )
}

/** Ancho de ordenador (el corte `lg` de Tailwind, 1024 px): la pantalla del jugador pasa a dos paneles. */
export const useEsEscritorio = (): boolean => useMediaQuery('(min-width: 1024px)')
