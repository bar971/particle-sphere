# Particle Sphere come menu di navigazione riutilizzabile

## Sintesi

Trasformare la demo WebGPU in una homepage/menù immersiva React, mantenendo il renderer separato dal componente UI. Cinque beacon futuristici rappresenteranno **Profilo**, **Progetti**, **Lab**, **Note** e **Contatti**. La soluzione resterà navigabile con tastiera, touch, movimento ridotto e senza WebGPU.

Prima di implementare il codice, salvare questo piano come `PLAN.md` nella root, committarlo e pubblicarlo su GitHub come documento di handoff indipendente.

## Architettura e API

- Migrare la demo a React, TypeScript e Vite; configurare Cloudflare Pages con `npm run build` e output `dist`.
- Estrarre un core WebGPU privo di dipendenze React, con lifecycle esplicito: inizializzazione, resize, rendering, orientamento, configurazione visuale e cleanup.
- Creare il componente interno esportato `ParticleSphereMenu`, senza preparare ancora un pacchetto npm.
- Definire gli item tramite un’interfaccia equivalente a:

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

- Usare coordinate manuali quando presenti e una distribuzione sferica deterministica per gli item senza posizione.
- Usare link HTML standard; `onNavigate` consente all’app ospitante di integrarli con qualsiasi router.
- Evitare aggiornamenti React a 60 fps: proiettare e posizionare i beacon tramite riferimenti DOM aggiornati dal loop del renderer.

## Esperienza e interazioni

- Visualizzare beacon HTML/SVG con alone neon, profondità e scala prospettica, ancorati matematicamente alla superficie.
- Nascondere e disabilitare i beacon realmente occultati dalla sfera mediante test raggio-sfera; attenuarli vicino al bordo.
- Mostrare etichette leggibili sui beacon visibili desktop; su mobile privilegiare icona, focus e menu alternativo.
- Alla selezione:
  - decelerare l’autorotazione in circa 250 ms;
  - mantenere evidenziato il beacon;
  - aprire subito una scheda con icona, titolo, riassunto e CTA “Esplora”;
  - collegare scheda e beacon con una linea SVG aggiornata durante la decelerazione.
- Posizionare la scheda desktop sul lato opposto al beacon; usare un bottom sheet su mobile.
- Chiudere con pulsante, `Esc` o click sullo sfondo; riprendere l’autorotazione gradualmente in circa 500 ms.
- Consentire drag e swipe con pointer capture:
  - yaw libero e pitch limitato a ±60°;
  - sospensione durante il trascinamento;
  - ripresa circa 800 ms dopo il rilascio, salvo scheda aperta;
  - soglia di movimento per distinguere click e drag.
- Estendere gli uniform shader da sola rotazione Y a yaw/pitch condivisi, mantenendo solidali particelle, linee, scie e beacon.
- Con `prefers-reduced-motion`, disattivare l’autorotazione e ridurre al minimo le transizioni; drag, beacon e lista restano disponibili.
- Rendere il pannello WebGPU invisibile normalmente e disponibile solo con `?debug=1`; la scorciatoia `H` funziona soltanto in debug.

## Homepage, pagine e fallback

- Usare una sola sorgente dati per beacon, schede e lista alternativa.
- Aggiungere un pulsante “Menu” sempre accessibile che apre un elenco semantico di tutte le destinazioni.
- Creare cinque pagine placeholder italiane tramite il router dell’app demo:
  - `/profilo`
  - `/progetti`
  - `/lab`
  - `/note`
  - `/contatti`
- Tenere React Router fuori dal componente riutilizzabile; usarlo soltanto nell’app demo.
- Aggiungere la riscrittura SPA per Cloudflare Pages, così ogni rotta funziona anche con accesso o refresh diretto.
- Se WebGPU non è disponibile, mostrare sfondo CSS coerente, introduzione e menu completo anziché un errore bloccante.
- Preservare `particle-sphere.pages.dev` e usare un branch con preview Cloudflare prima del merge su `main`.

## Verifica e criteri di accettazione

- Test unitari:
  - conversione latitudine/longitudine;
  - distribuzione automatica stabile;
  - orientamento yaw/pitch e proiezione;
  - occultamento fronte/retro;
  - arresto, ripresa e stato di selezione.
- Test del componente:
  - selezione via mouse, touch, `Tab`, `Enter` e `Space`;
  - chiusura via `Esc`, sfondo e pulsante;
  - callback di navigazione e link standard;
  - menu alternativo sincronizzato;
  - comportamento `prefers-reduced-motion`;
  - fallback senza `navigator.gpu`;
  - cleanup di RAF, listener e risorse in React Strict Mode.
- Test end-to-end desktop e mobile:
  - drag senza attivazioni accidentali;
  - scheda e linea sempre entro viewport;
  - navigazione e refresh diretto delle cinque rotte;
  - nessun beacon cliccabile attraverso la sfera.
- Verifica reale in Chrome/Edge con WebGPU:
  - nessun errore shader o console;
  - rendering fluido con 40.000 particelle, 16 scie e 5 beacon;
  - nessun re-render React continuo.
- Validare il deployment preview e, dopo il merge, confermare su Cloudflare il trigger `github:push` e lo stato `success`.

## Assunzioni

- Interfaccia e placeholder saranno inizialmente in italiano.
- Il componente è interno ma progettato per essere estratto in futuro.
- La configurazione consigliata è 5–8 beacon; non viene imposto un limite tecnico rigido.
- La prima iterazione non include immagini nelle schede, CMS, localizzazione bilingue o pubblicazione npm.
