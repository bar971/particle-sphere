# Particle Sphere Menu

Homepage immersiva React con una sfera WebGPU da 40.000 particelle. Cinque beacon navigano tra Profilo, Progetti, Lab, Note e Contatti; su mobile sono disponibili swipe, bottom sheet e dock rapido.

## Demo

https://particle-sphere.pages.dev

## Sviluppo

```bash
npm install
npm run dev
```

Test e build di produzione:

```bash
npm test
npm run build
```

## Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`

La regola `public/_redirects` abilita refresh e accesso diretto alle route SPA.

## Architettura

- `src/ParticleSphereMenu.tsx` — componente riutilizzabile, beacon e interazioni
- `src/webgpu-core.ts` — lifecycle WebGPU indipendente da React
- `src/sphereMath.ts` — distribuzione, orientamento, proiezione e visibilità
- `src/App.tsx` — dati e routing della demo
- `js/` e `shaders/` — sistemi grafici WebGPU

Senza WebGPU l’interfaccia passa automaticamente alla modalità CSS con menu completo. Il pannello diagnostico è disponibile solo con `?debug=1`; in quella modalità il tasto `H` lo mostra o nasconde.
