struct Uniforms {
  viewProj: mat4x4<f32>,
  camRight: vec4<f32>,
  camUp: vec4<f32>,
  params: vec4<f32>, // x: time, y: phase, z: dimensione sprite, w: aspect
};

struct Particle {
  pos: vec4<f32>,
  color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> basePositions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> outParticles: array<Particle>;

fn hash3(p: vec3<f32>) -> f32 {
  var p3 = fract(p * vec3<f32>(0.1031, 0.1030, 0.0973));
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn noise3(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (vec3<f32>(3.0) - 2.0 * f);

  let c000 = hash3(i + vec3<f32>(0.0, 0.0, 0.0));
  let c100 = hash3(i + vec3<f32>(1.0, 0.0, 0.0));
  let c010 = hash3(i + vec3<f32>(0.0, 1.0, 0.0));
  let c110 = hash3(i + vec3<f32>(1.0, 1.0, 0.0));
  let c001 = hash3(i + vec3<f32>(0.0, 0.0, 1.0));
  let c101 = hash3(i + vec3<f32>(1.0, 0.0, 1.0));
  let c011 = hash3(i + vec3<f32>(0.0, 1.0, 1.0));
  let c111 = hash3(i + vec3<f32>(1.0, 1.0, 1.0));

  let x00 = mix(c000, c100, u.x);
  let x10 = mix(c010, c110, u.x);
  let x01 = mix(c001, c101, u.x);
  let x11 = mix(c011, c111, u.x);

  let y0 = mix(x00, x10, u.y);
  let y1 = mix(x01, x11, u.y);

  return mix(y0, y1, u.z);
}

fn potential(p: vec3<f32>) -> vec3<f32> {
  return vec3<f32>(
    noise3(p + vec3<f32>(12.3, 5.7, 91.1)),
    noise3(p + vec3<f32>(44.1, 3.2, 8.9)),
    noise3(p + vec3<f32>(2.4, 77.3, 15.6))
  );
}

const EPS: f32 = 0.06;

// curl-noise: rotore del campo potenziale, calcolato con differenze finite centrali
fn curl(p: vec3<f32>) -> vec3<f32> {
  let dx = (potential(p + vec3<f32>(EPS, 0.0, 0.0)) - potential(p - vec3<f32>(EPS, 0.0, 0.0))) / (2.0 * EPS);
  let dy = (potential(p + vec3<f32>(0.0, EPS, 0.0)) - potential(p - vec3<f32>(0.0, EPS, 0.0))) / (2.0 * EPS);
  let dz = (potential(p + vec3<f32>(0.0, 0.0, EPS)) - potential(p - vec3<f32>(0.0, 0.0, EPS))) / (2.0 * EPS);

  return vec3<f32>(
    dy.z - dz.y,
    dz.x - dx.z,
    dx.y - dy.x
  );
}

fn rotateY(p: vec3<f32>, a: f32) -> vec3<f32> {
  let c = cos(a);
  let s = sin(a);
  return vec3<f32>(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

fn rotateYawPitch(p: vec3<f32>, yaw: f32, pitch: f32) -> vec3<f32> {
  let y = rotateY(p, yaw);
  let c = cos(pitch);
  let s = sin(pitch);
  return vec3<f32>(y.x, c * y.y - s * y.z, s * y.y + c * y.z);
}

// Palette neon "insegna elettrica": magenta/rosa dominante sul bordo, accento
// ciano/turchese elettrico, tocchi di arancio neon. Colore iniziale e finale
// coincidono (arancioNeon) per una chiusura morbida del ciclo cromatico.
// Ogni colore ha almeno un canale a 0 cosi' il bloom accende il neon senza
// far scattare il clipping bianco (nessuna terna satura su tutti i canali insieme).
// Il ciano e' sempre "cuscinettato" dal magenta e non tocca mai direttamente
// l'arancio: essendo quasi complementari, un contatto diretto nel punto di
// massima densita'/luminosita' (i poli, dove rim e' ovunque vicino a 1 e le
// linee convergono) sommava in additive blending fino a macchie bianco-grigiastre.
fn paletteColor(t: f32, intensity: f32) -> vec4<f32> {
  let tt = fract(t);
  let arancioNeon = vec3<f32>(1.0, 0.22, 0.0);
  let magentaNeon = vec3<f32>(1.0, 0.0, 0.48);
  let cianoNeon = vec3<f32>(0.0, 0.9, 1.0);
  let verdeNeon = vec3<f32>(0.2, 1.0, 0.38);

  var col: vec3<f32>;
  if (tt < 0.15) {
    col = mix(arancioNeon, magentaNeon, tt / 0.15);
  } else if (tt < 0.55) {
    col = magentaNeon; // banda magenta/rosa neon dominante
  } else if (tt < 0.7) {
    col = mix(magentaNeon, cianoNeon, (tt - 0.55) / 0.15);
  } else if (tt < 0.82) {
    col = mix(cianoNeon, verdeNeon, (tt - 0.7) / 0.12);
  } else if (tt < 0.9) {
    col = mix(verdeNeon, magentaNeon, (tt - 0.82) / 0.08);
  } else {
    col = mix(magentaNeon, arancioNeon, (tt - 0.9) / 0.1);
  }
  let brightness = 0.25 + intensity * 1.0;
  return vec4<f32>(col * brightness, 1.0);
}

// Posizione camera (fissa, coerente con js/main.js: eye = [0,0,3.2]).
const CAM_POS: vec3<f32> = vec3<f32>(0.0, 0.0, 3.2);

// Fattore di rim light: le particelle rivolte verso la camera (centro del disco visibile)
// restano fioche, quelle sul bordo (normale quasi perpendicolare alla viewDir) si accendono.
// viewDir e' calcolata per-particella (non piu' costante) per evitare la macchia larga
// vicino ai poli dovuta all'approssimazione della direzione camera.
fn rimFactor(normal: vec3<f32>, worldPos: vec3<f32>) -> f32 {
  let viewDir = normalize(CAM_POS - worldPos);
  let rim = pow(clamp(1.0 - abs(dot(normal, viewDir)), 0.0, 1.0), 3.0);
  return mix(0.04, 1.0, rim);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= arrayLength(&basePositions)) {
    return;
  }

  let base = basePositions[idx].xyz;
  let phase = (uniforms.params.x / 20.0) * 2.0 * 3.14159265;

  // offset periodico nel dominio del tempo: solo armoniche intere di 1/T -> periodicita' esatta
  let flowOffset = vec3<f32>(cos(phase), sin(phase), cos(2.0 * phase)) * 0.6;
  let c = curl(base * 1.5 + flowOffset);
  // ampiezza dello spostamento ridotta (~62% in meno) per una sagoma esterna quasi circolare
  let displaced = base + c * 0.045;

  // shell-mix alzato (0.4 -> 0.65): bordo esterno piu' liscio/circolare,
  // il moto organico interno resta visibile perche' agisce solo su 'displaced'.
  let shell = mix(displaced, normalize(displaced) * length(base), 0.65);
  let rotated = rotateYawPitch(shell, uniforms.params.y, uniforms.params.w);

  let colorPhase = fract(base.y * 0.5 + phase / (2.0 * 3.14159265));
  let col = paletteColor(colorPhase, length(c));

  let normal = normalize(rotated);
  let rim = rimFactor(normal, rotated);

  // Corpo: viola scuro fisso e uniforme (evita la tinta rossastra che il
  // colorPhase dava al corpo quando il rim e' al floor). Bordo: colore neon
  // della palette. La miscela e' guidata dal rim factor.
  let corpoViola = vec3<f32>(0.045, 0.12, 0.19);
  let mixedCol = mix(corpoViola, col.rgb, smoothstep(0.04, 0.6, rim));

  outParticles[idx].pos = vec4<f32>(rotated, 1.0);
  outParticles[idx].color = vec4<f32>(mixedCol * rim, col.a);
}
