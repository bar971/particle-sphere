# Particle Sphere Menu — Handoff

## Stato del progetto

Il repository contiene una homepage/menù immersiva React basata sulla demo WebGPU originale. La sfera da 40.000 particelle è lo sfondo interattivo di cinque destinazioni: **Profilo**, **Progetti**, **Lab**, **Note** e **Contatti**.

La versione corrente è pubblicata su:

- Produzione: https://particle-sphere.pages.dev
- Branch di produzione: `main`
- Build command Cloudflare Pages: `npm run build`
- Build output directory: `dist`

Il componente principale è interno al progetto, ma l’API è già pensata per una futura estrazione in un pacchetto.

## Stack e comandi

- React 19
- TypeScript
- Vite
- React Router
- WebGPU e WGSL
- Vitest, Testing Library e jsdom
- Cloudflare Pages

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

La build di produzione deve generare `dist`. Non pubblicare la root del repository: il browser riceverebbe `src/main.tsx` non compilato e mostrerebbe una pagina bianca.

## Struttura

### Applicazione React

- `src/main.tsx`: bootstrap React, Strict Mode e `BrowserRouter`.
- `src/App.tsx`: unica sorgente dati per le cinque destinazioni e route placeholder.
- `src/ParticleSphereMenu.tsx`: componente riutilizzabile, beacon, scheda, menu alternativo, drag e pannello visuale.
- `src/styles.css`: interfaccia desktop/mobile, fallback, animazioni e accessibilità motion.

React Router resta intenzionalmente fuori da `ParticleSphereMenu`: l’app intercetta `onNavigate`, mentre il componente continua a esporre link HTML standard.

### Core grafico

- `src/webgpu-core.ts`: lifecycle WebGPU indipendente da React (`create`, `resize`, `render`, `configure`, `destroy`).
- `src/sphereMath.ts`: coordinate sferiche, distribuzione deterministica, yaw/pitch, proiezione e fronte/retro.
- `src/rotationController.ts`: autorotazione, decelerazione, selezione, drag, ripresa e movimento ridotto.
- `js/`: sistemi particelle, linee, scie, bloom, sfondo e matematica WebGPU originali.
- `shaders/`: sorgenti WGSL.
- `public/shaders/`: copia servita a runtime dalla build Vite. Quando si modifica uno shader, aggiornare anche questa directory.

Yaw e pitch sono condivisi da particelle, linee, scie e beacon DOM. Il loop aggiorna direttamente gli elementi tramite ref, evitando render React a 60 fps.

## API del componente

```ts
interface SphereMenuItem {
  id: string;
  title: string;
  summary: string;
  href: string;
  icon?: React.ReactNode;
  accentColor?: string;
  position?: {
    latitudeDeg: number;
    longitudeDeg: number;
  };
  target?: "_self" | "_blank";
}

interface ParticleSphereMenuProps {
  items: SphereMenuItem[];
  autoRotate?: boolean;
  rotationPeriodSeconds?: number;
  onNavigate?: (
    item: SphereMenuItem,
    event: React.MouseEvent<HTMLAnchorElement>
  ) => void;
  debugControls?: boolean;
  ariaLabel?: string;
  className?: string;
}
```

Gli item senza posizione manuale ricevono coordinate stabili tramite distribuzione sferica deterministica.

## Interazioni

### Desktop

- Drag libero in yaw e pitch limitato a ±60°.
- Il testo dell’esperienza non è selezionabile durante il drag.
- Click su un beacon: arresto graduale, evidenziazione e scheda con CTA.
- Linea SVG tra beacon e scheda.
- Chiusura tramite pulsante, sfondo o `Esc`.
- Ripresa graduale dell’autorotazione.

### Mobile

- Swipe sulla sfera con pointer capture.
- Beacon con target touch ampi.
- Una sola etichetta contestuale resta visibile sulla sfera: normalmente quella del beacon più frontale, con priorità al beacon selezionato se visibile.
- Gerarchia tipografica mobile dedicata: titolo più compatto, testo guida e microtesti con contrasto e dimensioni maggiori.
- Scheda presentata come bottom sheet leggibile in portrait; su telefoni in landscape diventa un pannello laterale per non comprimere il contenuto.
- Il blocco introduttivo “PORTFOLIO / 2026” parte da 18 px dal bordo superiore, oltre alla safe area del dispositivo.
- Menu completo sempre disponibile.
- Safe area e viewport dinamica (`100dvh`) rispettate in alto e in basso, inclusi telefoni piccoli da 320 px e landscape touch.

### Beacon posteriori

I beacon sul lato nascosto non scompaiono: restano come echi sbiaditi, più piccoli, leggermente sfocati e desaturati. Sono intenzionalmente non cliccabili, esclusi dal `Tab` e `aria-hidden` finché sono occultati, così non è possibile attivarli attraverso la sfera.

### Movimento ridotto

Con `prefers-reduced-motion: reduce` l’autorotazione viene disattivata e le transizioni diventano quasi istantanee. Drag, menu e navigazione restano disponibili.

## Pannello visuale nascosto

Il pannello controlla in tempo reale:

- numero di particelle;
- numero di linee;
- numero di scie;
- dimensione dei punti;
- ripristino dei valori predefiniti.

Accesso:

- desktop: doppio click su “PORTFOLIO / 2026”;
- mobile: pressione prolungata di circa 800 ms sulla stessa scritta;
- tastiera: `H`;
- chiusura: `Esc` o pulsante ×.

Comportamento query string:

- nessun parametro: pannello disponibile tramite gesto nascosto;
- `?debug=1`: pannello disponibile esplicitamente;
- `?debug=0`: pannello e scorciatoia completamente disabilitati.

## Palette

La palette shader combina magenta, ciano, arancio e verde neon. Il corpo precedentemente viola è stato spostato verso un blu-petrolio scuro per bilanciare l’immagine. La stessa funzione colore è replicata negli shader di particelle, linee e scie: eventuali modifiche vanno mantenute coerenti nei tre file.

## Fallback e accessibilità

- Senza `navigator.gpu`, la pagina mantiene lo sfondo CSS, l’introduzione e il menu completo.
- I link sono semantici e funzionano senza un router specifico.
- Il menu alternativo usa una lista ordinata.
- `Enter`, `Space`, `Tab` ed `Esc` sono supportati.
- Gli elementi occultati non ricevono focus.
- Il renderer annulla RAF, listener e device durante il cleanup, anche in React Strict Mode.

## Routing

Route disponibili:

- `/profilo`
- `/progetti`
- `/lab`
- `/note`
- `/contatti`

`public/_redirects` contiene la rewrite SPA, quindi refresh e accesso diretto alle route devono restituire `index.html`.

## Test

La suite corrente copre:

- conversione latitudine/longitudine;
- distribuzione stabile;
- yaw/pitch e proiezione;
- fronte/retro;
- selezione, arresto e ripresa;
- movimento ridotto;
- menu semantico e link standard;
- assenza del dock mobile e selezione tramite beacon;
- callback di navigazione;
- pannello visuale abilitato/disabilitato;
- beacon posteriori visibili ma non interattivi.

Al momento dell’handoff risultano **13 test superati** e una build TypeScript/Vite valida.

## Deployment Cloudflare

### Stato al 17 agosto 2026

- Il commit `8b9154f` (`Fix mobile dock across responsive breakpoints`) è già presente su `origin/main`.
- L’aggiornamento più recente rimuove il dock mobile e porta il blocco introduttivo a 18 px dal bordo superiore, rispettando la safe area.
- Test e build dell’aggiornamento più recente risultano validi: **13 test superati** e output Vite generato correttamente.
- Lo stato del deployment Cloudflare non è stato ricontrollato dopo quest’ultimo aggiornamento.
- Dopo il push, verificare che Cloudflare acquisisca il commit più recente e pubblichi gli asset aggiornati.

Configurazione richiesta:

```text
Production branch: main
Build command: npm run build
Build output directory: dist
```

È già presente una regola SPA in `public/_redirects`. Dopo ogni cambiamento rilevante verificare che l’HTML di produzione punti a `/assets/index-*.js` con MIME `application/javascript`, non a `/src/main.tsx`.

Comandi diagnostici utili:

```bash
npx wrangler pages deployment list --project-name particle-sphere
npm run build
```

Per un deploy manuale di emergenza:

```bash
npx wrangler pages deploy dist --project-name particle-sphere --branch main
```

## Checklist per modifiche future

1. Aggiornare la sorgente dati in `src/App.tsx` per aggiungere o cambiare destinazioni.
2. Se si modificano shader, sincronizzare `shaders/` e `public/shaders/`.
3. Eseguire `npm test`.
4. Eseguire `npm run build`.
5. Controllare `git diff --check`.
6. Dopo il push, verificare il deployment automatico Cloudflare e almeno una route diretta.
7. Per modifiche grafiche WebGPU, effettuare una prova reale in Chrome o Edge e controllare la console.

## Limiti noti e prossimi passi

- Le cinque pagine interne sono placeholder.
- Non sono ancora presenti CMS, immagini nelle schede o localizzazione bilingue.
- Il componente non è pubblicato come pacchetto npm.
- I test automatici non sostituiscono la verifica visuale reale WebGPU desktop/mobile.
- La duplicazione degli shader tra `shaders/` e `public/shaders/` potrebbe essere eliminata in futuro importandoli come asset Vite raw o URL.
