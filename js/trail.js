// Scia luminosa: un arco di cerchio massimo (asse casuale) percorso da una "testa"
// luminosa con coda che sfuma esponenzialmente dietro di essa. La geometria e' un
// nastro di triangoli (non piu' una linea 1px): lo spessore e' massimo alla testa
// e si assottiglia verso la coda seguendo la stessa intensita' del bagliore.
//
// Pool dinamico: piu' scie possono essere attive contemporaneamente (fino a
// MAX_TRAILS, riciclate quando finiscono la loro vita). Compaiono a intervalli
// casuali indipendenti da quante sono gia' attive.
//
// La scia co-ruota con la sfera (stessa fase/rotationY di particelle e linee), ma
// la sua geometria (arco/asse/durata/colore) e il suo scheduling nel tempo sono
// generati con Math.random e usano un orologio "grezzo" indipendente dal loop
// seamless da 20s: non toccano mai fase o armoniche della scena esistente, quindi
// le scie non si ripetono identiche ad ogni ciclo (comportamento voluto).

import { vec3Normalize, vec3Cross } from './math.js';

export const POINTS_PER_TRAIL = 128; // deve rispecchiare NUM_POINTS in shaders/trail.render.wgsl
export const MAX_TRAILS = 16; // deve rispecchiare MAX_TRAILS in shaders/trail.render.wgsl
const FLOATS_PER_TRAIL = 16; // u(vec4) + v(vec4) + params(vec4) + params2(vec4)

// --- Parametri di SCHEDULING (definitivi) ---
// Intervallo casuale uniforme tra 2 e 8 secondi, sia per il primo spawn che per i
// successivi; indipendente da quante scie sono attualmente attive.
const SPAWN_MIN_SEC = 2;
const SPAWN_MAX_SEC = 8;
const FIRST_SPAWN_MIN_SEC = 2;
const FIRST_SPAWN_MAX_SEC = 8;

// --- Parametri della scia ---
const ARC_MIN_DEG = 90; // lunghezza minima dell'arco
const ARC_MAX_DEG = 270; // lunghezza massima dell'arco (mai giro completo)
const HEAD_MIN_SEC = 2; // durata minima della traversata della testa
const HEAD_MAX_SEC = 4; // durata massima della traversata della testa
const TAIL_MIN_DEG = 20; // lunghezza minima della coda (falloff esponenziale)
const TAIL_MAX_DEG = 40; // lunghezza massima della coda
const TAIL_DECAY_K = 3.0; // costante di decadimento esponenziale (in "lunghezze coda")
const TAIL_MARGIN = 3.0; // quante "lunghezze coda" extra si concedono alla coda per spegnersi del tutto dopo che la testa ha finito
const FADE_TIME = 0.15; // secondi di fade-in/out morbido a inizio/fine dell'intera animazione

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

// Base ortonormale casuale per l'arco: axis = normale del piano del cerchio
// massimo, u = punto di partenza sull'arco, v = perpendicolare a u nello stesso
// piano (v = axis x u). pos(theta) = u*cos(theta) + v*sin(theta) resta sempre
// sulla sfera unitaria.
function randomArcBasis() {
  const axis = vec3Normalize([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1]);
  const helper = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = vec3Normalize(vec3Cross(helper, axis));
  const v = vec3Cross(axis, u);
  return { u, v };
}

export async function createTrailSystem(device, uniformBuffer, sceneFormat, sphereRadius) {
  const radius = sphereRadius * 1.01; // leggermente sopra la superficie, come le linee

  // Storage buffer con il pool di scie attive (dimensione fissa, slot riciclati).
  const trailStorageBuffer = device.createBuffer({
    size: MAX_TRAILS * FLOATS_PER_TRAIL * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const code = await fetch('shaders/trail.render.wgsl').then((r) => r.text());
  const module = device.createShaderModule({ code });

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs_main',
      // Nessun vertex buffer: la geometria del nastro (punto + lato) e' ricavata
      // interamente da vertex_index/instance_index nello shader.
    },
    fragment: {
      module,
      entryPoint: 'fs_main',
      targets: [
        {
          format: sceneFormat,
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
          },
        },
      ],
    },
    primitive: { topology: 'triangle-strip' },
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: trailStorageBuffer } },
    ],
  });

  const uniformData = new Float32Array(MAX_TRAILS * FLOATS_PER_TRAIL);

  // Stato dello scheduler: array di scie attive (pool dinamico, riciclato) e tempo
  // assoluto del prossimo tentativo di spawn.
  let activeTrails = [];
  let nextSpawnTime = randRange(FIRST_SPAWN_MIN_SEC, FIRST_SPAWN_MAX_SEC);
  let activeCount = 0;

  function spawnTrail(startTime) {
    const { u, v } = randomArcBasis();
    const arcLenDeg = randRange(ARC_MIN_DEG, ARC_MAX_DEG);
    const arcLenRad = (arcLenDeg * Math.PI) / 180;
    const headDuration = randRange(HEAD_MIN_SEC, HEAD_MAX_SEC);
    const tailLenDeg = randRange(TAIL_MIN_DEG, TAIL_MAX_DEG);
    const tailLenRad = (tailLenDeg * Math.PI) / 180;
    const colorHue = Math.random();

    // Tempo extra oltre alla traversata della testa perche' la coda (che segue a
    // distanza angolare tailLenRad) possa spegnersi del tutto dopo l'arrivo della testa.
    const tailFracOfArc = tailLenRad / arcLenRad;
    const totalDuration = headDuration * (1 + tailFracOfArc * TAIL_MARGIN);

    return {
      u: [u[0] * radius, u[1] * radius, u[2] * radius],
      v: [v[0] * radius, v[1] * radius, v[2] * radius],
      arcLenRad,
      tailLenRad,
      colorHue,
      startTime,
      headDuration,
      totalDuration,
    };
  }

  // rawTSec: tempo assoluto trascorso (secondi), NON modulo LOOP_PERIOD - lo
  // scheduling delle scie e' volutamente indipendente dal loop seamless da 20s.
  function update(rawTSec) {
    // Tentativo di spawn: indipendente da quante scie sono gia' attive. Se il pool
    // e' pieno lo spawn viene saltato in silenzio, ma il prossimo tentativo viene
    // comunque schedulato normalmente.
    if (rawTSec >= nextSpawnTime) {
      if (activeTrails.length < MAX_TRAILS) {
        activeTrails.push(spawnTrail(rawTSec));
      }
      nextSpawnTime = rawTSec + randRange(SPAWN_MIN_SEC, SPAWN_MAX_SEC);
    }

    // Rimuove le scie a fine vita (testa arrivata + coda spenta + fade-out).
    activeTrails = activeTrails.filter((trail) => rawTSec - trail.startTime < trail.totalDuration);

    activeCount = activeTrails.length;
    for (let i = 0; i < activeCount; i++) {
      const trail = activeTrails[i];
      const elapsed = rawTSec - trail.startTime;
      const progress = elapsed / trail.headDuration; // puo' superare 1 mentre la coda si spegne
      const envelope = clamp01(elapsed / FADE_TIME) * clamp01((trail.totalDuration - elapsed) / FADE_TIME);

      const base = i * FLOATS_PER_TRAIL;
      uniformData.set([trail.u[0], trail.u[1], trail.u[2], 0], base + 0);
      uniformData.set([trail.v[0], trail.v[1], trail.v[2], 0], base + 4);
      uniformData.set([trail.arcLenRad, progress, trail.tailLenRad, trail.colorHue], base + 8);
      uniformData.set([envelope, 1, 0, 0], base + 12);
    }
    // Gli slot oltre activeCount restano con i valori scritti l'ultima volta che
    // erano occupati, ma non vengono mai letti: il draw usa instanceCount = activeCount.
    device.queue.writeBuffer(trailStorageBuffer, 0, uniformData, 0, activeCount * FLOATS_PER_TRAIL);
  }

  return {
    update,
    isActive() {
      return activeCount > 0;
    },
    draw(renderPass) {
      if (activeCount === 0) return;
      renderPass.setPipeline(pipeline);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(POINTS_PER_TRAIL * 2, activeCount);
    },
  };
}
