struct Uniforms {
  viewProj: mat4x4<f32>,
  camRight: vec4<f32>,
  camUp: vec4<f32>,
  params: vec4<f32>, // x: time, y: phase, z: dimensione sprite, w: aspect
};

// Dati di UNA scia. Deve rispecchiare esattamente il layout scritto in js/trail.js
// (64 byte: u vec4 + v vec4 + params vec4 + params2 vec4).
struct TrailData {
  u: vec4<f32>,       // vettore base 1 dell'arco (xyz), gia' scalato al raggio della sfera
  v: vec4<f32>,       // vettore base 2 dell'arco (xyz), perpendicolare a u nello stesso piano
  params: vec4<f32>,  // x: lunghezza arco (rad), y: progresso testa (puo' superare 1), z: lunghezza coda (rad), w: hue colore
  params2: vec4<f32>, // x: inviluppo fade-in/out globale, y/z/w: inutilizzati
};

// Pool di scie attive: array a dimensione fissa in uno storage buffer, indicizzato
// da instance_index. Deve rispecchiare MAX_TRAILS in js/trail.js.
const MAX_TRAILS: u32 = 150u;

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> trails: array<TrailData, MAX_TRAILS>;

struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

fn rotateY(p: vec3<f32>, a: f32) -> vec3<f32> {
  let c = cos(a);
  let s = sin(a);
  return vec3<f32>(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

// Stessa palette neon di lines.render.wgsl / particles.compute.wgsl, duplicata qui
// per coerenza cromatica (ogni shader del progetto la porta con se').
fn paletteColor(t: f32, intensity: f32) -> vec4<f32> {
  let tt = fract(t);
  let arancioNeon = vec3<f32>(1.0, 0.22, 0.0);
  let magentaNeon = vec3<f32>(1.0, 0.0, 0.48);
  let cianoNeon = vec3<f32>(0.0, 0.9, 1.0);

  var col: vec3<f32>;
  if (tt < 0.15) {
    col = mix(arancioNeon, magentaNeon, tt / 0.15);
  } else if (tt < 0.55) {
    col = magentaNeon;
  } else if (tt < 0.75) {
    col = mix(magentaNeon, cianoNeon, (tt - 0.55) / 0.2);
  } else if (tt < 0.9) {
    col = mix(cianoNeon, magentaNeon, (tt - 0.75) / 0.15);
  } else {
    col = mix(magentaNeon, arancioNeon, (tt - 0.9) / 0.1);
  }
  let brightness = 0.25 + intensity * 1.0;
  return vec4<f32>(col * brightness, 1.0);
}

const TAIL_DECAY_K: f32 = 3.0; // deve rispecchiare TAIL_DECAY_K in js/trail.js
// Guadagno di picco: porta la testa (intensity=1) ben oltre la soglia bloom (1.1)
// senza clippare a bianco piatto, perche' la palette ha sempre un canale a 0.
const PEAK_BRIGHTNESS: f32 = 15.0;

// Numero di punti campionati lungo l'arco (deve rispecchiare POINTS_PER_TRAIL in js/trail.js).
const NUM_POINTS: u32 = 128u;
// Spessore massimo del nastro (unita' sfera, raggio 1), raggiunto alla testa;
// si assottiglia verso la coda seguendo la stessa intensita' del bagliore.
const MAX_THICKNESS: f32 = 0.015;

// Nessun buffer vertici: la geometria del nastro (2 vertici per punto dell'arco,
// spostati di +-meta' spessore) e' ricavata interamente da vertex_index/instance_index.
// instance_index seleziona la scia nel pool (trails[]), vertex_index seleziona il
// punto lungo l'arco e il lato del nastro (pari = lato -, dispari = lato +).
@vertex
fn vs_main(@builtin(vertex_index) vidx: u32, @builtin(instance_index) iidx: u32) -> VSOut {
  let trailUniforms = trails[iidx];

  let pointIndex = vidx / 2u;
  let side = select(-1.0, 1.0, (vidx % 2u) == 1u);
  let t = f32(pointIndex) / f32(NUM_POINTS - 1u);

  let arcLenRad = trailUniforms.params.x;
  let theta = t * arcLenRad;
  let cosT = cos(theta);
  let sinT = sin(theta);
  let posOnArc = trailUniforms.u.xyz * cosT + trailUniforms.v.xyz * sinT;

  // Tangente all'arco (derivata di posOnArc rispetto a theta) e normale radiale
  // alla sfera: la perpendicolare tra le due, tangente alla superficie, e' la
  // direzione lungo cui il nastro si allarga.
  let tangent = normalize(-trailUniforms.u.xyz * sinT + trailUniforms.v.xyz * cosT);
  let sphereNormal = normalize(posOnArc);
  let perp = normalize(cross(tangent, sphereNormal));

  let progress = trailUniforms.params.y;
  let tailLenRad = trailUniforms.params.z;
  let hue = trailUniforms.params.w;
  let envelope = trailUniforms.params2.x;

  // delta >= 0: il punto e' la testa o e' dietro di essa (gia' "acceso").
  // delta < 0: il punto e' oltre la testa, non ancora raggiunto -> spento.
  let delta = progress - t;
  var intensity = 0.0;
  if (delta >= 0.0) {
    let deltaRad = delta * arcLenRad;
    intensity = exp(-deltaRad / max(tailLenRad, 0.001) * TAIL_DECAY_K);
  }

  let lit = intensity * envelope;

  // Spessore del nastro: massimo alla testa, si assottiglia verso la coda in modo
  // solidale con il bagliore (stesso fattore "lit"), fino a quasi zero.
  let halfWidth = MAX_THICKNESS * 0.5 * lit;
  let posLocal = posOnArc + perp * halfWidth * side;

  // Co-rotazione con la sfera: stessa fase globale usata da particelle e linee.
  let phase = uniforms.params.y;
  let rotated = rotateY(posLocal, phase);

  var out: VSOut;
  out.position = uniforms.viewProj * vec4<f32>(rotated, 1.0);

  let baseCol = paletteColor(hue, 0.0).rgb;
  out.color = vec4<f32>(baseCol * lit * PEAK_BRIGHTNESS, lit);
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  return vec4<f32>(in.color.rgb, in.color.a);
}
