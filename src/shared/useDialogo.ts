import { useEffect, useRef, type RefObject } from 'react'

const FOCALIZABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Comportamiento de un diálogo modal accesible:
 *  - el foco entra en el diálogo y, al cerrarlo, vuelve al elemento que lo abrió;
 *  - Escape lo cierra;
 *  - Tab y Mayús+Tab no salen del diálogo;
 *  - el fondo no se desplaza mientras está abierto.
 * `contenedor` debe tener `tabIndex={-1}` para poder recibir el foco.
 */
export function useDialogo(
  abierto: boolean,
  onCerrar: () => void,
  contenedor: RefObject<HTMLElement | null>,
) {
  // Siempre la última función de cierre, sin reiniciar los efectos en cada render.
  const cerrar = useRef(onCerrar)
  useEffect(() => {
    cerrar.current = onCerrar
  })

  useEffect(() => {
    if (!abierto) return
    const previo = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const panel = contenedor.current
    panel?.focus()

    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        cerrar.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const foco = [...panel.querySelectorAll<HTMLElement>(FOCALIZABLES)].filter(
        (el) => el.offsetParent !== null,
      )
      if (foco.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }
      const primero = foco[0]
      const ultimo = foco[foco.length - 1]
      const actual = document.activeElement
      if (e.shiftKey && (actual === primero || actual === panel)) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && actual === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', alTecla)
    return () => {
      document.removeEventListener('keydown', alTecla)
      document.body.style.overflow = overflow
      previo?.focus?.()
    }
  }, [abierto, contenedor])
}
