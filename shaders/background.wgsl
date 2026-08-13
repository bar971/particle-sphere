// Sfondo: gradiente radiale scuro blu/viola + poche decine di stelline statiche fioche.
// Disegnato come primo draw call nella scenePass, prima di linee e particelle
// (nessuna interferenza con la catena bloom: luminosita' sempre sotto la soglia bright-pass).

struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_fullscreen(@builtin(vertex_index) vIdx: u32) -> VSOut {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  let p = pos[vIdx];
  var out: VSOut;
  out.position = vec4<f32>(p, 0.0, 1.0);
  out.uv = vec2<f32>(p.x * 0.5 + 0.5, 1.0 - (p.y * 0.5 + 0.5));
  return out;
}

struct BgParams {
  aspect: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<uniform> bg: BgParams;

fn hash2(p: vec2<f32>) -> f32 {
  let h = dot(p, vec2<f32>(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

@fragment
fn fs_background(in: VSOut) -> @location(0) vec4<f32> {
  // gradiente radiale: centro piu' chiaro (~#14102a), bordi quasi neri (~#05040c)
  var uv = in.uv - vec2<f32>(0.5, 0.5);
  uv.x = uv.x * bg.aspect; // corregge l'aspect ratio per un gradiente circolare
  let d = length(uv);

  let centro = vec3<f32>(0.078, 0.063, 0.165);
  let bordo = vec3<f32>(0.020, 0.016, 0.047);
  var col = mix(centro, bordo, smoothstep(0.0, 0.75, d));

  // stelline statiche: griglia sparsa (~40 celle), soglia alta -> poche decine di punti
  let cell = vec2<f32>(48.0, 27.0);
  let cellUv = in.uv * cell;
  let cellId = floor(cellUv);
  let cellF = fract(cellUv);
  let starRand = hash2(cellId);
  if (starRand > 0.965) {
    let starPos = vec2<f32>(hash2(cellId + vec2<f32>(3.1, 1.7)), hash2(cellId + vec2<f32>(7.7, 4.4)));
    let distStar = length(cellF - starPos);
    // luminosita' fioca (max ~0.4): resta ben sotto la soglia bright-pass (1.1)
    let bright = 0.15 + hash2(cellId + vec2<f32>(9.3, 2.2)) * 0.25;
    let glow = smoothstep(0.12, 0.0, distStar) * bright;
    col = col + vec3<f32>(glow);
  }

  return vec4<f32>(col, 1.0);
}
