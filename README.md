# Particle Sphere

Sfera di 40.000 particelle realizzata in WebGPU puro (nessuna libreria: no Three.js, nessuna dipendenza esterna), con rim lighting neon, bloom, linee di energia procedurali e scie luminose casuali. Loop seamless di 20 secondi.

Ispirata al video Vecteezy: https://www.vecteezy.com/video/70810576

## Demo

https://particle-sphere.pages.dev

## Requisiti

Un browser con supporto WebGPU (es. Chrome o Edge recenti). WebGPU richiede un secure context, quindi la pagina va servita via HTTP/HTTPS e non aperta direttamente da file locale (`file://`).

## Esecuzione in locale

```
python -m http.server 8420
```

Poi apri http://localhost:8420 nel browser.

## Struttura del progetto

- `index.html` — canvas full-viewport e inizializzazione WebGPU
- `js/` — logica applicativa (init WebGPU, particelle, linee, bloom, sfondo, scie luminose, matematica)
- `shaders/` — shader WGSL (compute e render) per particelle, linee, bloom, sfondo, scie
