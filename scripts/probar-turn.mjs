// Comprueba qué servidores ICE responden desde esta máquina: obtiene candidatos
// (host/srflx/relay) y errores de cada servidor. Uso: node scripts/probar-turn.mjs
import { chromium } from 'playwright-core'

const servidores = {
  'STUN google': [{ urls: 'stun:stun.l.google.com:19302' }],
  'STUN cloudflare': [{ urls: 'stun:stun.cloudflare.com:3478' }],
  'TURN peerjs (UDP eu)': [{ urls: 'turn:eu-0.turn.peerjs.com:3478', username: 'peerjs', credential: 'peerjsp' }],
  'TURN peerjs (UDP us)': [{ urls: 'turn:us-0.turn.peerjs.com:3478', username: 'peerjs', credential: 'peerjsp' }],
  'TURN openrelay 80': [{ urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' }],
  'TURN openrelay 443 tcp': [{ urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }],
  'TURNS openrelay 443': [{ urls: 'turns:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }],
}

const navegador = await chromium.launch({ channel: 'msedge' })
const pagina = await navegador.newPage()
await pagina.goto('about:blank')

for (const [nombre, iceServers] of Object.entries(servidores)) {
  const r = await pagina.evaluate(async (iceServers) => {
    const pc = new RTCPeerConnection({ iceServers })
    const tipos = { host: 0, srflx: 0, relay: 0 }
    const errores = []
    pc.onicecandidate = (e) => {
      const t = e.candidate?.candidate.match(/ typ (\w+)/)?.[1]
      if (t) tipos[t]++
    }
    pc.onicecandidateerror = (e) => errores.push(`${e.errorCode} ${e.errorText || ''} (${e.url})`)
    pc.createDataChannel('x')
    await pc.setLocalDescription(await pc.createOffer())
    await new Promise((res) => setTimeout(res, 6000))
    pc.close()
    return { tipos, errores }
  }, iceServers)
  console.log(nombre.padEnd(26), JSON.stringify(r.tipos), r.errores.slice(0, 2).join(' | '))
}
await navegador.close()
