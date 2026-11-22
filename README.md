# Nakreo

Juego de cartas multijugador en tiempo real de **roles ocultos, faroles y eliminación**, para 2 a 6 jugadores. Se juega en el navegador: una pantalla grande hace de **mesa** (anfitrión) y cada jugador usa su **teléfono** como mano privada. Sin backend propio: la conexión es P2P con WebRTC (PeerJS) y el sitio es 100 % estático.

> **Nota sobre el origen.** Nakreo está *inspirado en las mecánicas* de juegos de faroles y roles ocultos como Coup, pero su **tema, nombres, textos y arte son originales**. No usa material de ese juego y no tiene relación ni afiliación con sus autores ni editores.

## Cómo se juega

Ambientación: en la estación **Kepler-9**, corporaciones rivales compiten por el control. Cada jugador dirige una y empieza con **2 cartas de rol ocultas** (sus cargos) y **2 créditos (◈)**. Gana el último con algún cargo en pie.

En su turno, cada jugador hace **una** acción:

| Acción | Coste | Efecto | Rol requerido | Bloquea |
|---|---|---|---|---|
| Ingreso | – | +1 crédito | – | – |
| Subsidio | – | +2 créditos | – | Director Financiero (cualquiera) |
| Golpe de Mando | 7 | Un rival pierde una carta | – | No se puede bloquear |
| Dividendos | – | +3 créditos | Director Financiero | – |
| Sabotaje | 3 | Un rival pierde una carta | Saboteador | Jefe de Seguridad (el objetivo) |
| Desvío | – | Roba hasta 2 créditos a un rival | Contrabandista | Contrabandista o Ingeniero (el objetivo) |
| Reasignación | – | Roba 2 cartas del mazo, conserva las que quiera y devuelve el resto | Ingeniero | – |

- **Faroles:** puedes declarar una acción de rol aunque no tengas la carta.
- **Desafíos:** cualquier jugador puede desafiar una acción de rol o un bloqueo. El desafiado debe mostrar la carta. Si la tiene, el desafiante pierde una carta y el desafiado cambia la suya por otra del mazo. Si no, el desafiado pierde la carta que mostró y su acción se cancela. También puede **rendirse** y perder una carta a su elección.
- **Límite de créditos:** con **14 ◈ o más** no se pueden hacer acciones que den créditos; hay que gastar.
- Al perder la segunda carta, un jugador queda eliminado. Al terminar la partida, el anfitrión puede **jugar de nuevo** (mismos jugadores, cartas nuevas) o **volver al lobby** para que entren jugadores nuevos.

## Arquitectura

```
 Teléfono (cliente) ──┐                           ┌── Teléfono (cliente)
   solo intenciones   │      WebRTC (PeerJS)      │   solo intenciones
   y su proyección    ├─────────────────────────► │   y su proyección
                      │      ┌──────────────┐     │
                      └────► │  ANFITRIÓN   │ ◄───┘
                             │ (la "mesa")  │
                             │ estado       │  señalización inicial:
                             │ completo +   │  servidor público de PeerJS
                             │ motor de     │
                             │ reglas       │
                             └──────────────┘
```

### Host autoritativo

Un navegador (el anfitrión) guarda el **estado completo** y es el único que ejecuta el motor de reglas. Los clientes solo envían **intenciones** ("quiero hacer Sabotaje contra X", "desafío") y reciben una **proyección** del estado. El anfitrión valida cada intención; si es ilegal, devuelve un error y el estado no cambia.

### Patrón de proyección de estado

Es la pieza central de seguridad. El estado completo contiene información oculta (manos de todos y mazo). **Nunca se envía.** Antes de salir por la red pasa por `src/game/proyeccion.ts`:

- `proyectarEstado(estado, idJugador)`: lo que ve **un jugador**: su mano completa y sus créditos; de los demás solo créditos, cuántas cartas vivas tienen y las cartas que ya **perdieron** (públicas); el turno, la fase y el registro de eventos público.
- `proyectarPublico(estado)`: lo que ve **cualquier espectador** (la pantalla del anfitrión). No contiene ninguna mano ni ningún id de carta.

Decisiones de diseño:

1. **Lista blanca, no filtrado.** Cada objeto proyectado se construye campo por campo; nunca se copia ni se hace `...spread` de una estructura del estado completo. Si en el futuro se añade un campo oculto, no se filtra por accidente.
2. **Información que vive dentro de las fases.** Mientras un Ingeniero decide su Reasignación, las cartas robadas viven en la fase. Se proyectan solo para su dueño.
3. **Sin referencias compartidas.** Todo se copia, así que mutar una proyección no toca el estado del anfitrión.
4. **Eventos públicos por construcción.** El registro solo contiene información que ya es pública (p. ej. una carta perdida o mostrada en un desafío).
5. **El conteo del mazo es deliberadamente público.** Da pistas sin revelar contenido y añade deducción al juego. Quitarlo es borrar un campo.
6. **La UI del anfitrión solo consume la proyección pública.** Aunque un componente se equivocara, no podría pintar manos ajenas en la TV.

### Identidad y mensajes no confiables

- El anfitrión **nunca** confía en quién dice ser el cliente: las intenciones no llevan el campo `jugador`; lo rellena el anfitrión según la conexión de la que llegó el mensaje.
- **Reconexión por token:** el cliente genera un token aleatorio (guardado en `sessionStorage`). Al reconectar con el mismo token recupera su asiento y su mano. Los tokens no se envían nunca a otros jugadores.
- Todo mensaje entrante se **valida en tiempo de ejecución** y se reconstruye con una lista blanca de campos; el resto se descarta.

### Capas

| Capa | Dónde | Notas |
|---|---|---|
| Motor de reglas | `src/game/` | Funciones puras: `aplicar(estado, intención, rng)`. Sin red ni UI |
| Proyección | `src/game/proyeccion.ts` | Frontera de seguridad |
| Protocolo | `src/shared/protocolo.ts` | Mensajes tipados y validadores |
| Transporte | `src/shared/transporte.ts`, `peerTransporte.ts` | Interfaz abstracta + adaptador de PeerJS (permite probar con un transporte falso) |
| Anfitrión | `src/host/` | `HostServidor` (sala, lobby, motor, envío) + UI de la mesa |
| Cliente | `src/client/` | Conexión con reconexión automática + UI móvil |

## Stack

React 19 · Vite · TypeScript · Tailwind CSS 4 · Zustand · PeerJS · `qrcode` · Vitest.

## Ejecutar en local

Requiere Node.js 20.19 o superior.

```bash
npm install
npm run dev
```

Abre `http://localhost:5173/Nakreo/`. Pulsa **Crear sala** para ser el anfitrión.

### Probar con teléfonos reales

Los móviles no ven `localhost`. Expón el servidor a tu red local:

```bash
npm run dev -- --host
```

En la pantalla del anfitrión (solo cuando estás en `localhost`) aparece un campo **URL base**: escribe la URL de tu equipo, p. ej. `http://192.168.1.20:5173/Nakreo/`, y el QR se regenerará con ella. Necesitas conexión a internet (para la señalización de PeerJS) y que los dispositivos estén en la misma red.

### Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Comprobación de tipos y build de producción en `dist/` |
| `npm run preview` | Sirve el build localmente |
| `npm test` | Tests (Vitest) |
| `npm run lint` | Linter (oxlint) |
| `npm run deploy` | Lint + tests + build + publicación en GitHub Pages |
| `npm run revision-visual` | Capturas de cada pantalla en móvil y escritorio (con `npm run dev` en marcha; requiere Edge o Chrome) |

## Tests

`npm test` cubre:

- **Motor de reglas:** desafío exitoso y fallido, rendición, bloqueos, eliminación, fin de partida, límite de créditos, reasignación e intenciones ilegales.
- **Proyección:** que ningún jugador (ni la vista pública) pueda ver cartas ajenas ni el mazo. Incluye un **fuzz**: partidas aleatorias de 2 a 6 jugadores donde, en *cada* paso, se comprueba la proyección de todos los observadores.
- **Red:** lobby, suplantación de identidad, mensajes inválidos, reconexión y desconexión, usando un transporte falso en memoria.
- **Vista del cliente:** qué panel y qué acciones se muestran en cada fase.

La conexión WebRTC real no se prueba automáticamente: hay que verificarla con dispositivos.

## Desplegar en GitHub Pages

1. Crea un repositorio llamado **`Nakreo`** (la ruta base de Vite es `/Nakreo/`; si usas otro nombre, define `VITE_BASE=/otro-nombre/` al construir).
2. Conéctalo y publica:

   ```bash
   git remote add origin https://github.com/<usuario>/Nakreo.git
   git push -u origin main
   npm run deploy
   ```

   `npm run deploy` ejecuta lint, tests y build, y sube `dist/` a la rama `gh-pages`.
3. En GitHub: **Settings → Pages → Source: Deploy from a branch → `gh-pages` / `(root)`**.
4. El juego quedará en `https://<usuario>.github.io/Nakreo/`.

La navegación usa **rutas con hash** (`#/host`, `#/join?room=…`), así que no hace falta configuración de reescrituras y el QR puede apuntar directamente a una sala.

## Limitaciones conocidas

- **El anfitrión debe mantener la pestaña abierta**: es el servidor de la partida. Si la cierra o recarga, la partida se pierde. Además, los navegadores pueden suspender pestañas en segundo plano o con la pantalla bloqueada; conviene dejar la pestaña visible y el equipo despierto.
- **HTTPS.** GitHub Pages sirve por HTTPS, y desde una página HTTPS solo se puede usar señalización cifrada (el servidor público de PeerJS lo es). Los canales de datos WebRTC en sí no exigen HTTPS, pero sí lo hace cualquier despliegue en Pages.
- **Dependencia del servidor de señalización público** de PeerJS (`0.peerjs.com`): sin garantías de disponibilidad. Solo se usa para establecer la conexión; el juego va directo entre navegadores.
- **TURN gratuito de PeerJS, sin garantías:** si la conexión directa es imposible (NAT estricto, Wi-Fi con aislamiento de clientes), el tráfico se retransmite por un TURN público de la comunidad, que puede estar saturado. Para algo fiable, configura uno propio (ver «Problemas de conexión»).
- **El anfitrión ve toda la información** (es el árbitro). La arquitectura protege a los jugadores entre sí, no de un anfitrión tramposo.
- **Sin temporizadores:** un jugador desconectado o inactivo bloquea la partida hasta que vuelve.
- **Sin persistencia:** no se guarda nada; cada partida vive en memoria.
- **Vibración:** `navigator.vibrate` no existe en iOS Safari; allí solo hay feedback visual.
- **Iconos provisionales** (emoji); el arte propio está pendiente.

## Problemas de conexión

Si un dispositivo muestra «No se pudo establecer la conexión con el anfitrión», el mensaje incluye un resumen de la negociación WebRTC (`candidatos locales N, STUN N, relé TURN N; estado ICE: …`). Cómo leerlo:

- **STUN 0:** el dispositivo no alcanza los servidores STUN (red que bloquea UDP).
- **Relé TURN 0:** no se pudo usar el TURN; la conexión depende de que ambos dispositivos se vean directamente.
- **Estado ICE `checking` o `failed`:** no hay camino entre los dos dispositivos.

Causas habituales y soluciones:

1. **Aislamiento de clientes («AP isolation») en el router o Wi-Fi de invitados:** los dispositivos de la misma Wi-Fi no pueden comunicarse entre sí. Desactívalo o usa otra red.
2. **El anfitrión usa Chrome con candidatos mDNS** (ocultan la IP local con un nombre `.local`), que algunos móviles no resuelven. Para comprobarlo, en el Chrome del anfitrión abre `chrome://flags/#enable-webrtc-hide-local-ips-with-mdns`, desactívalo y reinicia el navegador.
3. **Prueba con datos móviles** en el teléfono (con el juego publicado en GitHub Pages): descarta problemas de la Wi-Fi local.
4. **VPN o DNS privado** en el dispositivo: desactívalos para probar.

### TURN propio (opcional, el más fiable)

Un servidor TURN retransmite el tráfico y funciona en casi cualquier red. Hay planes gratuitos (p. ej. Metered Open Relay) o puedes alojar `coturn`. Crea un archivo `.env.local` (está en `.gitignore`) y vuelve a construir:

```
VITE_TURN_URL=turn:tu-servidor:3478
VITE_TURN_USER=usuario
VITE_TURN_CREDENTIAL=clave
```

> Las credenciales acaban dentro del JavaScript publicado, así que cualquiera podría verlas. Usa un plan con límite de tráfico y no reutilices credenciales importantes.

## Estructura

```
src/
├── game/      Motor de reglas puro, tipos, proyección y tests
├── shared/    Protocolo, transporte, textos y componentes comunes
├── host/      Anfitrión: HostServidor, store y UI de la mesa
├── client/    Cliente: conexión, store, vista y UI móvil
├── home/      Pantalla de inicio
└── dev/       Galería de pantallas (solo desarrollo, no se publica)
scripts/       Revisión visual con Playwright
```

## Licencia

[MIT](LICENSE) © 2026 Julian Rodriguez
