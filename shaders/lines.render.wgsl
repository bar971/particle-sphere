struct Uniforms {
  viewProj: mat4x4<f32>,
  camRight: vec4<f32>,
  camUp: vec4<f32>,
  params: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

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

// Palette neon "insegna elettrica": magenta/rosa dominante, accento ciano/turchese
// elettrico, tocchi di arancio neon (identica a particles.compute.wgsl per coerenza
// cromatica). Chiusura morbida del ciclo: primo e ultimo colore coincidono.
// Il ciano e' cuscinettato dal magenta e non tocca mai direttamente l'arancio
// (vedi commento in particles.compute.wgsl: evita macchie bianco-grigiastre
// dove rim e convergenza delle linee sono massimi, es. ai poli).
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
    col = magentaNeon;
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

// Posizione camera (vedi particles.compute.wgsl per la stessa logica: viewDir per-vertice
// invece di una direzione costante, per evitare la macchia larga vicino ai poli).
const CAM_POS: vec3<f32> = vec3<f32>(0.0, 0.0, 3.2);

fn rimFactor(normal: vec3<f32>, worldPos: vec3<f32>) -> f32 {
  let viewDir = normalize(CAM_POS - worldPos);
  let rim = pow(clamp(1.0 - abs(dot(normal, viewDir)), 0.0, 1.0), 3.0);
  return mix(0.04, 1.0, rim);
}

// posPacked.xyz = posizione sulla sfera, posPacked.w = indice linea + t (t in [0,0.999))
@vertex
fn vs_main(@location(0) posPacked: vec4<f32>) -> VSOut {
  let lineIndex = floor(posPacked.w);
  let t = fract(posPacked.w);
  let phase = (uniforms.params.x / 20.0) * 2.0 * 3.14159265;

  let rotated = rotateYawPitch(posPacked.xyz, uniforms.params.y, uniforms.params.w);

  var out: VSOut;
  out.position = uniforms.viewProj * vec4<f32>(rotated, 1.0);

  let hueBase = fract(lineIndex * 0.171 + 0.15);
  let baseCol = paletteColor(hueBase, 0.0);

  let flow = fract(t - phase / (2.0 * 3.14159265));
  let pulse = pow(0.5 + 0.5 * sin(flow * 6.28318530718 * 3.0), 4.0);

  let normal = normalize(rotated);
  let rim = rimFactor(normal, rotated);

  // Stessa logica corpo/bordo di particles.compute.wgsl: corpo viola scuro
  // uniforme, bordo neon della palette, miscela guidata dal rim factor.
  let corpoViola = vec3<f32>(0.045, 0.12, 0.19);
  let edgeCol = baseCol.rgb * (0.5 + pulse * 2.2);
  let mixedCol = mix(corpoViola, edgeCol, smoothstep(0.04, 0.6, rim));

  out.color = vec4<f32>(mixedCol * rim, 1.0);
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  return vec4<f32>(in.color.rgb, 1.0);
}
