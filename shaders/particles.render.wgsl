struct Uniforms {
  viewProj: mat4x4<f32>,
  camRight: vec4<f32>,
  camUp: vec4<f32>,
  params: vec4<f32>,
};

struct Particle {
  pos: vec4<f32>,
  color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> particles: array<Particle>;

struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) uv: vec2<f32>,
};

const QUAD = array<vec2<f32>, 4>(
  vec2<f32>(-1.0, -1.0),
  vec2<f32>(1.0, -1.0),
  vec2<f32>(-1.0, 1.0),
  vec2<f32>(1.0, 1.0)
);

@vertex
fn vs_main(@builtin(vertex_index) vIdx: u32, @builtin(instance_index) iIdx: u32) -> VSOut {
  let p = particles[iIdx];
  let corner = QUAD[vIdx];
  let size = uniforms.params.z;
  let worldPos = p.pos.xyz + (uniforms.camRight.xyz * corner.x + uniforms.camUp.xyz * corner.y) * size;

  var out: VSOut;
  out.position = uniforms.viewProj * vec4<f32>(worldPos, 1.0);
  out.color = p.color;
  out.uv = corner;
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let d = length(in.uv);
  let alpha = smoothstep(1.0, 0.0, d) * smoothstep(1.0, 0.0, d);
  return vec4<f32>(in.color.rgb * alpha, alpha);
}
