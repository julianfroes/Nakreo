# Nakreo

Juego de cartas multijugador en tiempo real de **roles ocultos, faroles y eliminación**, para 2 a 8 jugadores (2 a 6 en el modo sin roles especiales). Se juega en el navegador: una pantalla grande hace de **mesa** (anfitrión) y cada jugador usa su **teléfono** como mano privada. Sin backend propio: la conexión es P2P con WebRTC (PeerJS) y el sitio es 100 % estático.

> **Nota sobre el origen.** Nakreo está *inspirado en las mecánicas* de juegos de faroles y roles ocultos como Coup, pero su **tema, nombres, textos y arte son originales**. No usa material de ese juego y no tiene relación ni afiliación con sus autores ni editores.

## Cómo se juega

Ambientación: en la estación **Kepler-9**, corporaciones rivales compiten por el control. Cada jugador dirige una y empieza con **2 cartas de rol ocultas** (sus cargos, de un mazo de 20 cartas: 3 copias de cada rol más una carta **especial** por rol) y **2 créditos (◈)**. Gana el último con algún cargo en pie.

En su turno, cada jugador hace **una** acción:

| Acción | Coste | Efecto | Rol requerido | Bloqueable por |
|---|---|---|---|---|
| Sueldo mínimo | – | +1 crédito | – | No se puede bloquear |
| Nómina | – | +2 créditos | – | Cualquier otro jugador, con RH |
| Demanda laboral | 7 | Un rival pierde una carta | – | Quien la recibe, con Sindicalizado Especial (Contrademanda, un solo uso) |
| Malversación | – | +3 créditos | RH | No se puede bloquear |
| Robo de aguinaldo | – | +4 créditos | RH Especial | No se puede bloquear |
| Despido | 3 | Un rival pierde una carta | CEO | Quien la recibe, con Sindicalizado |
| Renuncia «voluntaria» | 3 | Un rival pierde una carta | CEO Especial | Quien la recibe, con Sindicalizado Especial (Contrademanda, un solo uso) |
| Robo de mérito | – | Roba hasta 2 créditos a un rival | Jefe de Área | Quien la recibe, con Jefe de Área o Ingeniero |
| Reasignación | – | Roba 2 cartas del mazo, conserva las que quiera y devuelve el resto | Ingeniero | No se puede bloquear |

- **Faroles:** puedes declarar una acción de rol aunque no tengas la carta.
- **Desafíos:** cualquier jugador puede desafiar una acción de rol o un bloqueo. El desafiado debe mostrar la carta. Si la tiene, el desafiante pierde una carta y el desafiado cambia la suya por otra del mazo. Si no, el desafiado pierde la carta que mostró y su acción se cancela. También puede **rendirse** y perder una carta a su elección.
- **Cartas especiales:** cada especial cuenta también como su rol normal y añade una habilidad. Se declaran aparte y **su desafío es el doble de arriesgado**:
  - **RH Especial:** Robo de aguinaldo da +4 en lugar de +3.
  - **CEO Especial:** su Renuncia «voluntaria» salta a los Sindicalizados normales; solo la frena el Sindicalizado Especial.
  - **Sindicalizado Especial** *(un solo uso)*: su **Contrademanda** cubre una Demanda laboral.
  - **Ingeniero Especial** *(un solo uso)*: al recibir una Demanda laboral, un Despido o una Renuncia «voluntaria», paga 2 ◈ (o 1 si es todo lo que tiene) para «explotar el site»: el atacante pierde una carta **antes** que él. Si eso deja al Ingeniero como único jugador vivo, gana (nunca hay empate). Si no, la acción cae igualmente sobre el Ingeniero, que descarta su carta primero.
  - **Jefe de Área Especial** *(un solo uso)*: su **Excusa de mérito** te salva de un farol. Se declara **antes de mostrar carta**, cuando te desafían. Si nadie la desafía no pierdes cartas, aunque tu acción se cancela. Si la desafían se resuelve sola: si la tienes, el desafiante pierde 2 cartas; si no, pierdes todas las tuyas sin elegir nada. Mostrar una carta equivocada ya no ofrece salvarse.
- **Bloquear o explotar el site, a la vez:** cuando recibes una Demanda laboral, un Despido o una Renuncia «voluntaria» (y tienes al menos 1 ◈), ves **juntas** tus opciones: **alegar** el bloqueo que corresponda («Alegar Sindicalizado»…), **explotar el site**, o dejar pasar. Eliges **una vía**: si explotas, ya no bloqueas; si dejas pasar, el ataque cae sin más ventanas. Si bloqueas y tu bloqueo **cae** (te desafían y no tenías la carta), todavía puedes explotar el site, así que farolear con un bloqueo siendo solo Ingeniero Especial es más creíble. Alegar no exige tener la carta, pero si te desafían debes mostrarla.
- **El Ingeniero normal no bloquea el Despido** (ni siquiera siendo su objetivo): lo bloquea el Sindicalizado. Solo el Ingeniero Especial puede vengarse explotando el site.
- **Riesgo doble:** si mientes sobre una carta especial y te desafían, pierdes **2 cartas** (con 2 cartas vivas, quedas eliminado). Si desafías un reclamo especial verdadero, el desafiante pierde **2 cartas**. Rendirse ante un reclamo especial también cuesta 2.
- **Un solo uso:** si declaras una habilidad de un solo uso y nadie te desafía, **devuelves tus cartas vivas al mazo, se baraja y robas otras** (pueden tocarte las mismas). Si te desafían y demuestras la carta, solo se cambia la mostrada. En el Ingeniero Especial, primero se descarta la carta perdida y luego vuelve la restante.
- **Los créditos de una acción se gastan al declararla.** Solo se devuelven si descubren el farol de quien la declaró. Si el objetivo cae por su propio farol (o por cualquier otra causa) antes de que la acción lo alcance, el atacante **no** recupera sus créditos.
- **Límite de créditos:** con **14 ◈ o más** no se pueden hacer acciones que den créditos; hay que gastar.
- Al perder la segunda carta, un jugador queda eliminado. Al terminar la partida, el anfitrión puede **jugar de nuevo** (mismos jugadores, cartas nuevas) o **volver al lobby** para que entren jugadores nuevos.

## Modos de juego y aforo

Al crear la sala, el interruptor **«Jugar sin roles especiales»** elige el modo:

| Modo | Mazo | Jugadores |
|---|---|---|
| Con roles especiales | 20 cartas | 2 a 8 |
| Sin roles especiales | 15 cartas | 2 a 6 |

- **Con roles especiales** (por defecto): el juego completo, con las cartas y habilidades especiales.
- **Sin roles especiales**: solo las 15 cartas normales. Desaparecen el Robo de aguinaldo, la Renuncia «voluntaria», la Contrademanda, Explotar el site y la Excusa de mérito (ni siquiera se puede farolear con ellos), y la **Demanda laboral no se puede bloquear**. El resto de la tabla de acciones no cambia.
- El anfitrión puede **cambiar el modo en la sala de espera** hasta iniciar la partida. El host valida el cambio: se rechaza si ya hay más jugadores de los que caben (7 jugadores no caben sin roles especiales) y borra las marcas de «listo». «Jugar de nuevo» conserva el modo; tras «Volver al lobby» se puede cambiar otra vez.
- La sala de espera muestra el aforo (por ejemplo **4/6**) y avisa cuando está **llena**. Quien intenta entrar a una sala llena ve «Sala llena (6/6)» y su botón «Unirme» queda bloqueado para ese código hasta que pulse «Volver a intentar».
- Cada jugador puede marcar **«Estoy listo»**. Es solo una guía visual: no impide iniciar la partida.

## Formas de ser anfitrión

| Modo | Cómo se entra | Qué ve el anfitrión |
|---|---|---|
| **Mesa** | «Crear sala» | Pantalla grande (laptop o TV) con la vista pública: jugadores, créditos, cartas perdidas, registro y QR. No juega |
| **Anfitrión-jugador** | «Crear sala y jugar», o «Unirme a esta sala como jugador» desde la sala de espera de la mesa | La pantalla de un **jugador**: solo sus cartas privadas y acciones, **sin** la vista general. Útil si no hay un ordenador para hacer de mesa |

En el modo anfitrión-jugador, el navegador administra la sala y se une a ella como un jugador más por una **conexión local en memoria** (`src/shared/conexionLocal.ts`). El anfitrión la trata igual que a cualquier teléfono (identidad por conexión, validación y proyección), así que el jugador local recibe únicamente su proyección privada. Desde esa pantalla puede iniciar la partida y, al terminar, **jugar de nuevo**, **volver al lobby** o **cerrar la sala** (también hay un «Cerrar sala…» con confirmación durante la partida).

### Unirse como jugador desde la mesa

En la sala de espera de una mesa, el botón **«Unirme a esta sala como jugador»** pide un nombre y ocupa un asiento. Reglas, todas validadas por el host (el botón es solo una comodidad):

- **Solo con lugar y antes de iniciar:** si la sala está llena (según el modo: 8 o 6 jugadores) o la partida ya comenzó, el host lo rechaza y el botón aparece deshabilitado.
- **Un solo asiento:** el anfitrión no puede ocupar dos.
- **La pantalla pasa a ser la de un jugador:** deja de mostrar la mesa general, para que su mano no quede a la vista de quien mire la pantalla. Sigue siendo el árbitro. Si quieres jugar *y* proyectar la mesa, entra desde tu móvil con el QR como un jugador normal.
- **«Dejar mi asiento»:** antes de iniciar, el anfitrión puede liberar su asiento y volver a ser solo la mesa. Con la partida en curso no se puede.

## Salir de la partida

Cada jugador tiene **«Salir de la partida…»** bajo sus cartas, en una zona aparte de las acciones. Salir es definitivo, así que pide confirmación: *«Si sales no podrás reingresar a esta partida. Perderás tus vidas y, si tenías una acción pendiente, el turno continuará.»* El cliente solo envía la intención `salir`; el host la valida (la identidad sale de la conexión) y el motor la resuelve:

- Tus cartas vivas pasan al **descarte público**, tus créditos desaparecen y sales de la rotación de turnos. El registro dice «X abandonó la partida» y en la mesa figuras como **Retirado**.
- Si solo queda un jugador vivo, esa persona **gana** al instante.
- Lo que estuviera pendiente de ti se resuelve o se cancela, y el turno sigue con el siguiente jugador vivo:

| Si te vas siendo… | Resultado |
|---|---|
| quien hizo la acción, o su objetivo | La acción se cancela (sus créditos ya estaban gastados y no se devuelven) |
| alguien al que se le preguntaba si desafía o bloquea | Dejas de contar; si eras el último, la ventana se cierra como si todos hubieran pasado |
| quien bloqueaba | El bloqueo cae y la acción procede (si eras el objetivo, se desvanece) |
| el desafiado | Pierdes el desafío: el reclamo cae y el desafiante no pierde nada |
| quien desafiaba | El desafío se cae y el reclamo se sostiene, sin intercambio ni penalización |
| quien debía elegir qué carta perder | Pierdes todas y el flujo sigue sin ti |
| quien reasignaba | Tus cartas robadas vuelven al mazo y se baraja |

- **No puedes reingresar a esa partida:** el host rechaza tu token con «Abandonaste esta partida» y el botón «Unirme» queda bloqueado. Al usar «Volver al lobby» o «Jugar de nuevo», los asientos de los retirados desaparecen y pueden entrar de nuevo como jugadores nuevos.
- **En la sala de espera, o con la partida terminada**, salir simplemente **libera el asiento** (ya no queda un jugador «desconectado» bloqueando el inicio).
- **El anfitrión no se retira: su «Salir» cierra la sala para todos.** Antes avisa con un mensaje claro y, al confirmar, el host envía `salaCerrada` a cada jugador para que vea «El anfitrión cerró la sala» al instante, sin esperar a reintentos fallidos de reconexión. La mesa tiene su propio «Cerrar sala…» durante la partida.

## Pantalla del jugador: móvil y ordenador

La interfaz del jugador se adapta al ancho de la ventana (con CSS, así que también responde al redimensionarla):

| Ancho | Diseño |
|---|---|
| **< 768 px** (móvil) | Una columna: cabecera fija con los rivales, mis cartas y el panel de decisiones abajo |
| **768–1023 px** (tableta) | Una columna más ancha, con las acciones en 2 columnas |
| **≥ 1024 px** (ordenador) | **Dos paneles** centrados (ancho máximo ~1150 px). A la izquierda mi situación: mis datos, los rivales como tarjetas en rejilla, mis cartas más grandes y las consultas. A la derecha mis decisiones, con las acciones en 2 columnas y el panel fijo al hacer scroll, y el **registro** de los últimos eventos |

Las decisiones que tapan la pantalla (te desafían, debes perder una carta, reasignar) pasan a ser diálogos más anchos en ordenador, y la reasignación muestra las 4 cartas en fila. La mesa del anfitrión ya estaba pensada para pantallas grandes.

## Iconos de los roles

Cada rol tiene un icono SVG **propio** (`src/shared/iconos/IconoRol.tsx`), dibujado para Nakreo, así que no hay licencias ni atribuciones que respetar. Comparten cuadrícula de 24 × 24, trazo de 1,75 con extremos redondeados y un relleno tenue del mismo color, para que pesen igual:

| Rol | Icono | Color |
|---|---|---|
| **CEO** | maletín | rosa |
| **RH** | papeles | ámbar |
| **Sindicalizado** | escudo | violeta |
| **Jefe de Área** | chaleco | verde |
| **Ingeniero** | engranaje (el de siempre, redibujado con el mismo trazo que el resto) | azul |

- **Tamaños:** nunca menos de 24 px; 32–48 px en listas y botones, 64–72 px en las cartas.
- **Accesibilidad:** como imagen, el icono lleva `role="img"` y `aria-label` con el nombre del rol (y «Especial» si lo es). Cuando el nombre ya está escrito al lado, el icono es decorativo (`aria-hidden`) para que no se lea dos veces. Los colores son tonos claros sobre el fondo oscuro de las cartas; sobre los botones de color (cian) el icono hereda el color oscuro del texto para mantener el contraste.
- **Carta especial:** el mismo icono con un destello dorado en la esquina, además del borde dorado.
- La galería de desarrollo (`#/dev?vista=iconos`) muestra el set a 24, 32, 48 y 64 px.

## Reglas, Guía rápida y Descarte

Todo el texto de reglas sale de un único módulo (`src/shared/reglasContenido.ts`), que lee las acciones, los costes y los bloqueos del propio motor: nada puede quedar desfasado entre pantallas ni respecto al juego (un test compara la tabla de este README fila por fila).

- **Reglas (📖):** botón en la **pantalla principal** y en la **sala de espera** (anfitrión y jugador). Abre un panel con el reglamento completo en pestañas **Reglas · Acciones · Roles**. En la sala se muestra el modo de la sala (con o sin roles especiales); en la pantalla principal puedes elegir con qué modo leerlas.
- **Guía rápida (📖):** durante la partida, en la zona secundaria bajo tus cartas, lejos de las acciones. Panel superpuesto con **Acciones** (coste, qué hacen, qué carta exigen y quién puede bloquearlas) y **Roles** (qué hace cada uno y su carta especial). En móvil sale desde abajo y su botón «Cerrar» queda al alcance del pulgar; se cierra con un toque fuera, con Esc, con la «✕» o con «Cerrar». **No altera la partida**, que sigue actualizándose por detrás. Si te llega una decisión urgente (te desafían, debes perder una carta o reasignar), se cierra sola para no taparla. Sin roles especiales no muestra nada especial.
- **Descarte:** plegable «Descarte (n)» junto a la guía, con las cartas perdidas de **todos** los jugadores agrupadas por jugador y con su rol a la vista (las especiales, con su distintivo). Marca a los **Eliminados** y **Retirados**. Es información pública (se calcula solo con las cartas ya reveladas, nunca con cartas vivas ni con el mazo) y se actualiza en tiempo real aunque esté plegado.
- **Nota sobre la redacción de los bloqueos:** «Quien la recibe, con Sindicalizado» significa que solo puede bloquear el jugador contra quien va la acción; «Cualquier otro jugador, con RH» significa que puede bloquear cualquiera de los demás.

**Accesibilidad:** los paneles son diálogos modales (`role="dialog"`, `aria-modal`), el foco entra al abrirlos y vuelve al botón que los abrió, Tab no se sale del panel, Esc los cierra y el fondo no se desplaza. Las pestañas siguen el patrón ARIA (flechas, Inicio y Fin). El descarte es un botón con `aria-expanded`. Los movimientos respetan `prefers-reduced-motion`.

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

Un navegador (el anfitrión) guarda el **estado completo** y es el único que ejecuta el motor de reglas. Los clientes solo envían **intenciones** ("quiero hacer un Despido contra X", "desafío") y reciben una **proyección** del estado. El anfitrión valida cada intención; si es ilegal, devuelve un error y el estado no cambia.

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

- **Motor de reglas:** desafío exitoso y fallido, rendición, bloqueos, eliminación, fin de partida, límite de créditos, reasignación e intenciones ilegales, cartas especiales, modo sin roles especiales y **salir de la partida en cada fase** (acción, ventanas de desafío y bloqueo, reacciones, desafío, pérdida de carta, reasignación).
- **Proyección:** que ningún jugador (ni la vista pública) pueda ver cartas ajenas ni el mazo. Incluye un **fuzz**: partidas aleatorias de 2 a 8 jugadores donde, en *cada* paso, se comprueba la proyección de todos los observadores.
- **Red:** lobby, aforo por modo, «listo», suplantación de identidad, mensajes inválidos, reconexión y desconexión, asiento del anfitrión, salida y no reingreso de los retirados, y cierre ordenado de la sala, usando un transporte falso en memoria.
- **Vista del cliente:** qué panel y qué acciones se muestran en cada fase.
- **Iconos:** un icono distinto por rol, con su nombre accesible, decorativo cuando el nombre ya está al lado, tamaños, insignia especial, color por rol y engranaje bien formado.
- **Descarte y contenido de reglas:** agrupación por jugador, retirados y eliminados, tiempo real, ausencia de datos ocultos, y que las reglas del modo (acciones, roles, secciones) coincidan con el motor.

La conexión WebRTC real no entra en `npm test`, pero hay pruebas de extremo a extremo con navegadores reales (con `npm run dev` en marcha, internet y Edge/Chrome):

```bash
node scripts/e2e-anfitrion-jugador.mjs   # anfitrión-jugador + invitado
node scripts/e2e-modo-sala.mjs           # modo sin roles especiales, aforo, «listo», cambio de modo
node scripts/e2e-host-se-une.mjs         # el anfitrión de una mesa se une y deja su asiento
node scripts/e2e-salir.mjs               # salir de la sala y de la partida (3 navegadores)
node scripts/e2e-bloqueo-despido.mjs     # el objetivo de un Despido ve a la vez bloquear y explotar el site
node scripts/e2e-descarte-guia.mjs        # Reglas, Guía rápida y Descarte (teclado, foco, tiempo real)
node scripts/e2e-escritorio.mjs           # layout de ordenador: dos paneles, redimensionar, sin desbordes
```

Ambos navegadores corren en la misma máquina, así que no sustituye a probar con teléfonos reales en redes distintas.

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
- **Sin servidor TURN por defecto:** no existe un TURN público fiable (los que traía PeerJS, `turn.peerjs.com`, ya no responden; se verificó con `scripts/probar-turn.mjs`). Si la conexión directa entre dos dispositivos es imposible (Wi-Fi con aislamiento de clientes, mDNS bloqueado, NAT estricto), la conexión falla. Para tener respaldo, configura un TURN propio (ver «Problemas de conexión»).
- **El anfitrión ve toda la información** (es el árbitro). La arquitectura protege a los jugadores entre sí, no de un anfitrión tramposo. En el modo anfitrión-jugador la pantalla no muestra nada ajeno, pero el estado completo sigue en la memoria de ese navegador y alguien con conocimientos técnicos podría inspeccionarlo con las herramientas de desarrollador.
- **Pantalla encendida:** la aplicación pide al navegador que no apague la pantalla (Screen Wake Lock) en las pantallas de anfitrión y de jugador. Requiere HTTPS y un navegador compatible (Chrome en Android, Safari 16.4+), y el sistema puede ignorarlo con el ahorro de batería. Si el anfitrión es un móvil y cambia de app o se bloquea, la partida se cae para todos.
- **Sin temporizadores:** un jugador desconectado o inactivo bloquea la partida hasta que vuelve.
- **Sin persistencia:** no se guarda nada; cada partida vive en memoria.
- **Vibración:** `navigator.vibrate` no existe en iOS Safari; allí solo hay feedback visual.
- **Iconos provisionales** (emoji); el arte propio está pendiente.

## Problemas de conexión

Si un dispositivo muestra «No se pudo establecer la conexión con el anfitrión», el mensaje incluye un resumen de la negociación WebRTC (`candidatos locales N, STUN N, relé TURN N; estado ICE: …`). Cómo leerlo:

- **STUN 0:** el dispositivo no alcanza los servidores STUN (red que bloquea UDP).
- **Relé TURN 0:** no hay TURN configurado (o no responde); la conexión depende de que ambos dispositivos se vean directamente.
- **errores: 701 …:** el servidor ICE indicado no respondió.
- **Estado ICE `checking` o `failed`:** no hay camino entre los dos dispositivos.

Causas habituales y soluciones:

1. **Aislamiento de clientes («AP isolation») en el router o Wi-Fi de invitados:** los dispositivos de la misma Wi-Fi no pueden comunicarse entre sí. Desactívalo o usa otra red.
2. **Candidatos mDNS (la causa más probable si solo falla un modelo de teléfono).** Por privacidad, Chrome oculta la IP local en WebRTC detrás de un nombre `.local` que el otro dispositivo debe resolver con mensajes *multicast*. Algunos móviles filtran el tráfico multicast de la Wi-Fi para ahorrar batería y entonces no pueden resolver el nombre (ni responder a él). Solución: en el Chrome **del teléfono problemático** abre `chrome://flags`, busca «mDNS» (`#enable-webrtc-hide-local-ips-with-mdns`), ponlo en *Disabled* y reinicia Chrome. Con que uno de los dos extremos muestre su IP real basta para conectar. También sirve probar con otro navegador (p. ej. Firefox) en ese teléfono.
3. **Prueba con datos móviles** en el teléfono (con el juego publicado en GitHub Pages): descarta problemas de la Wi-Fi local.
4. **VPN o DNS privado** en el dispositivo: desactívalos para probar.

### TURN propio (opcional, el más fiable)

Un servidor TURN retransmite el tráfico y hace que la conexión funcione en casi cualquier red, a costa de pasar por un tercero (los datos de juego son poco más que mensajes de texto). Hay planes gratuitos (p. ej. [Metered](https://www.metered.ca/) o Xirsys) o puedes alojar `coturn`. Crea `.env.local` (está en `.gitignore`) con los datos de tu proveedor, separando varias URLs con comas, y vuelve a ejecutar `npm run deploy`:

```
VITE_TURN_URL=turn:tu-servidor:80,turn:tu-servidor:80?transport=tcp,turns:tu-servidor:443?transport=tcp
VITE_TURN_USER=usuario
VITE_TURN_CREDENTIAL=clave
```

Para comprobar que responde, añade ese servidor a `scripts/probar-turn.mjs` y ejecútalo: debe aparecer `relay` mayor que 0.

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
