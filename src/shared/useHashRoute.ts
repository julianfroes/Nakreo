import { useSyncExternalStore } from 'react'

/**
 * Router mínimo basado en el hash de la URL (#/host, #/join?room=ABCD).
 * GitHub Pages no soporta reescrituras de SPA, así que las rutas con hash
 * evitan el 404 al recargar y permiten que el QR apunte directo a una sala.
 */
export interface HashRoute {
  path: string
  params: URLSearchParams
}

function parse(): HashRoute {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const [path, query = ''] = raw.split('?')
  return { path: path || '/', params: new URLSearchParams(query) }
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

// useSyncExternalStore exige un snapshot estable: comparamos por string crudo.
const getSnapshot = () => window.location.hash

export function useHashRoute(): HashRoute {
  useSyncExternalStore(subscribe, getSnapshot)
  return parse()
}

export function navigate(to: string) {
  window.location.hash = to
}
