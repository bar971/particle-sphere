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

struct BloomParams {
  texel: vec2<f32>,
  mode: f32,  // 0 = bright-pass, 1 = blur orizzontale, 2 = blur verticale
  extra: f32, // soglia bright-pass
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;
@group(0) @binding(2) var<uniform> bParams: BloomParams;

@fragment
fn fs_bright(in: VSOut) -> @location(0) vec4<f32> {
  let c = textureSample(srcTex, srcSampler, in.uv).rgb;
  let l = dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
  let m = max(l - bParams.extra, 0.0) / max(l, 0.0001);
  return vec4<f32>(c * m, 1.0);
}

const WEIGHTS = array<f32, 5>(0.2270270270, 0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162);

@fragment
fn fs_blur(in: VSOut) -> @location(0) vec4<f32> {
  var dir: vec2<f32>;
  if (bParams.mode < 1.5) {
    dir = vec2<f32>(bParams.texel.x, 0.0);
  } else {
    dir = vec2<f32>(0.0, bParams.texel.y);
  }
  var col = textureSample(srcTex, srcSampler, in.uv).rgb * WEIGHTS[0];
  for (var i = 1; i < 5; i = i + 1) {
    let off = dir * f32(i);
    col = col + textureSample(srcTex, srcSampler, in.uv + off).rgb * WEIGHTS[i];
    col = col + textureSample(srcTex, srcSampler, in.uv - off).rgb * WEIGHTS[i];
  }
  return vec4<f32>(col, 1.0);
}

struct CompParams {
  bloomIntensity: f32,
  vignette: f32,
  exposure: f32,
  pad: f32,
};

@group(0) @binding(0) var sceneTex: texture_2d<f32>;
@group(0) @binding(1) var bloomTex: texture_2d<f32>;
@group(0) @binding(2) var compSampler: sampler;
@group(0) @binding(3) var<uniform> cParams: CompParams;

fn acesTonemap(x: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

@fragment
fn fs_composite(in: VSOut) -> @location(0) vec4<f32> {
  let scene = textureSample(sceneTex, compSampler, in.uv).rgb;
  let bloom = textureSample(bloomTex, compSampler, in.uv).rgb;
  var col = (scene + bloom * cParams.bloomIntensity) * cParams.exposure;
  col = acesTonemap(col);

  let d = distance(in.uv, vec2<f32>(0.5, 0.5));
  let vig = smoothstep(0.9, 0.35, d * cParams.vignette);
  col = col * mix(1.0, vig, 0.6);

  return vec4<f32>(col, 1.0);
}
