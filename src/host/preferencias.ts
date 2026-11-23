import { useCallback, useState } from 'react'

const CLAVE_MODO = 'nakreo-sin-especiales'
const CLAVE_NOMBRE = 'nakreo-nombre'

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

function guardar(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    // Sin almacenamiento (modo privado): la elección solo dura esta pantalla.
  }
}

/** Última elección del anfitrión para «Jugar sin roles especiales» (por dispositivo). */
export const leerSinEspeciales = (): boolean => leer(CLAVE_MODO) === '1'
export const guardarSinEspeciales = (sin: boolean) => guardar(CLAVE_MODO, sin ? '1' : '0')

/** Estado del interruptor de modo que recuerda la última elección. */
export function useSinEspeciales() {
  const [sin, setSin] = useState(leerSinEspeciales)
  const cambiar = useCallback((valor: boolean) => {
    setSin(valor)
    guardarSinEspeciales(valor)
  }, [])
  return [sin, cambiar] as const
}

/** Último nombre que usó el anfitrión como jugador (por dispositivo). */
export const leerNombre = (): string => leer(CLAVE_NOMBRE) ?? ''
export const guardarNombre = (nombre: string) => guardar(CLAVE_NOMBRE, nombre)
