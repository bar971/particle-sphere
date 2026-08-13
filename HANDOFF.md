# Handoff — Particle Sphere WebGPU

**Data:** 2026-08-13 (aggiornato dopo verifica visiva e 2 giri di ritocchi) · **Da riprendere su:** VS Code, cartella `C:\GHRepo\particle-sphere\` (spostata dalla posizione originale `C:\Users\chris\particle-sphere\`)

## Obiettivo
Replicare l'effetto del video Vecteezy https://www.vecteezy.com/video/70810576 : sfera astratta di particelle luminose che ruota lentamente, linee di energia colorate glow su sfondo scuro, loop seamless. Scelte utente: **WebGPU puro** (no Three.js, no librerie), **file separati**.

Piano approvato completo in: `C:\Users\chris\.claude\plans\vorrei-replicare-l-effetto-presente-humming-sparrow.md`

## Stato attuale: implementazione COMPLETA, verificata a schermo, 2 giri di ritocchi estetici fatti

### File (14)
- `index.html` — canvas full-viewport, fallback se `navigator.gpu` assente
- `js/main.js` — init WebGPU, loop RAF, resize, orchestrazione (background → linee → particelle → bloom)
- `js/math.js` — mat4/vec3 minime (perspective depth [0,1], lookAt, rotationY)
- `js/particles.js` — 40.000 punti Fibonacci-sphere, compute pipeline, render billboard instanced additive
- `js/lines.js` — 40 spirali procedurali × 128 punti, line-strip additive
- `js/bloom.js` — bright-pass → blur gaussiano separabile (2 iter, mezza risoluzione) → composite ACES
- `js/background.js` + `shaders/background.wgsl` — fullscreen pass: gradiente radiale `#14102a`→`#05040c` + ~40-50 stelline statiche fioche (sotto soglia bright-pass, non entrano nel bloom)
- `js/trail.js` + `shaders/trail.render.wgsl` — scie luminose "cometa" sulla superficie (v2): pool dinamico fino a 16 scie simultanee in storage buffer (16×64 byte), draw instanced triangle-strip 256 vertici generati da vertex_index (nastro spesso 0.015 max alla testa che si assottiglia con il fattore `lit`), spawn casuale ogni 2-8 s senza attendere la fine delle precedenti, arco di cerchio massimo con asse casuale 90°-270° (mai giro completo), testa che traversa in 2-4 s, coda esponenziale 20°-40° (decay 3.0), fade 0.15 s, colore campionato dalla palette neon, picco 15.0 (sopra soglia bloom, mai clipping perché la palette ha sempre un canale a 0), niente rim factor (visibile sul corpo scuro), co-ruota con `rotateY(phase)`. Scheduling su orologio assoluto `rawTSec` in main.js: NON tocca il loop seamless della scena (le scie, volutamente, non si ripetono uguali a ogni ciclo)
- `shaders/particles.compute.wgsl`, `shaders/particles.render.wgsl`, `shaders/lines.render.wgsl`, `shaders/bloom.wgsl` — caricati via `fetch()`

### Dettagli tecnici chiave
- **Loop seamless:** `phase = 2π·(t mod T)/T` con T=20s; curl-noise, rotazione e pulsazione linee usano solo armoniche intere della fase base
- Uniform buffer a 112 byte; bind group layout `'auto'` per ogni pipeline
- **Rim lighting** (particelle e linee): `pow(1−|dot(normale, viewDir)|, 3.0)`, viewDir esatto per-particella da `CAM_POS = vec3(0,0,3.2)`, floor 0.04 → corpo scuro, bordo acceso
- **Palette neon** (particelle e linee, giro 3): arancioNeon (1,0.22,0) → magentaNeon (1,0,0.48) dominante → cianoNeon (0,0.9,1) come accento complementare; ciclo 15/40/20/15/10% con ciano sempre cuscinettato dal magenta; corpo forzato a `corpoViola (0.16,0.06,0.26)` via `mix(corpoViola, col, smoothstep(0.04,0.6,rim))`
- Parametri estetici attuali: soglia bright-pass 1.1, composite [bloomIntensity 0.7, vignette 1.4, exposure 0.85], brightness `0.25 + intensity·1.0`, ampiezza curl-noise 0.045, shell-mix 0.65, sprite 0.018, distanza camera 3.2

### Verifiche fatte
- `node --check` su tutti i file JS → OK (exit 0)
- Verifica browser via Claude-in-Chrome: console SENZA errori, rotazione confermata su screenshot successivi
- Confronto visivo col frame del video Vecteezy: molto vicino (corpo viola scuro, bordo caldo rosso/arancio/magenta, sagoma quasi circolare, sfondo blu-viola con stelline)
- Ultimo screenshot buono: `C:\Users\chris\AppData\Local\Temp\claude-chrome-screenshots-Jb2273\screenshot-1786644785865-8.jpg`

### Verifiche giro 3
- **Loop seamless CONFERMATO**: screenshot a distanza di ~2 periodi (39.73 s reali via `performance.now()`) praticamente sovrapponibili; evoluzione fluida su 3 screenshot consecutivi; verifica di codice: solo funzioni trigonometriche della fase con armoniche intere → continuità matematica al wrap
- **FPS NON misurabile via estensione**: il tab controllato resta `visibilityState === "hidden"` → Chrome throttla rAF (misura 0.0-0.1 fittizia). Serve test con tab in primo piano sul desktop dell'utente

## Problemi noti / prossimi passi possibili
1. **Hotspot chiari ai poli** (residuo dopo 2 tentativi di mitigazione): additive blending + convergenza geometrica delle linee ai poli + ACES che desatura verso il bianco; per eliminarli servirebbe intervenire su bloom o geometria (distribuzione linee ai poli)
2. FPS da misurare con tab in primo piano
3. Confronto col video VERO in riproduzione mai riuscito (il player Vecteezy mostra solo il frame iniziale statico)

## Note operative
- Il progetto NON è un repo git (valutare `git init` alla ripresa se si vuole versionare)
- Lezione di sessione salvata in memoria: i subagent ereditano la plan mode del coordinator → uscire con ExitPlanMode prima di delegare implementazioni
