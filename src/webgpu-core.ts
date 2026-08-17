import { mat4LookAt, mat4Multiply, mat4Perspective } from '../js/math.js';
import { createParticleSystem, SPHERE_RADIUS } from '../js/particles.js';
import { createLineSystem } from '../js/lines.js';
import { createTrailSystem } from '../js/trail.js';
import { createBloomPipeline } from '../js/bloom.js';
import { createBackgroundPipeline } from '../js/background.js';

export interface VisualConfig { particleCount: number; lineCount: number; trailCount: number; spriteSize: number }
export interface FrameState { time: number; yaw: number; pitch: number }
export interface ParticleSphereRenderer { resize(): void; render(state: FrameState): void; configure(config: Partial<VisualConfig>): void; destroy(): void }
const defaults: VisualConfig = { particleCount: 40000, lineCount: 40, trailCount: 16, spriteSize: .018 };

export async function createParticleSphereRenderer(canvas: HTMLCanvasElement): Promise<ParticleSphereRenderer> {
  if (!navigator.gpu) throw new Error('WebGPU unavailable');
  const adapter = await navigator.gpu.requestAdapter(); if (!adapter) throw new Error('WebGPU adapter unavailable');
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu') as any; if (!context) throw new Error('WebGPU context unavailable');
  const format = navigator.gpu.getPreferredCanvasFormat();
  const uniformBuffer = device.createBuffer({ size: 112, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const [particles, lines, trails, bloom, background] = await Promise.all([
    createParticleSystem(device, uniformBuffer, 'rgba16float', defaults.particleCount),
    createLineSystem(device, uniformBuffer, 'rgba16float', SPHERE_RADIUS, defaults.lineCount),
    createTrailSystem(device, uniformBuffer, 'rgba16float', SPHERE_RADIUS, defaults.trailCount),
    createBloomPipeline(device, format), createBackgroundPipeline(device, 'rgba16float'),
  ]);
  let config = { ...defaults }, dead = false, lastW = 0, lastH = 0;
  const uniform = new Float32Array(28);
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.max(1, Math.floor(canvas.clientWidth * dpr)), h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (w === lastW && h === lastH) return; lastW = canvas.width = w; lastH = canvas.height = h;
    context.configure({ device, format, alphaMode: 'opaque' }); bloom.resize(w, h);
  }
  function render({ time, yaw, pitch }: FrameState) {
    if (dead) return; resize(); trails.update(time);
    const viewProj = mat4Multiply(mat4Perspective(Math.PI / 4, lastW / lastH, .1, 100), mat4LookAt([0,0,3.2],[0,0,0],[0,1,0]));
    uniform.set(viewProj); uniform.set([1,0,0,0],16); uniform.set([0,1,0,0],20); uniform.set([time,yaw,config.spriteSize,pitch],24);
    device.queue.writeBuffer(uniformBuffer, 0, uniform); background.setAspect(lastW / lastH);
    const encoder = device.createCommandEncoder(), compute = encoder.beginComputePass(); particles.update(compute); compute.end();
    const pass = encoder.beginRenderPass({ colorAttachments: [{ view: bloom.getSceneView(), loadOp:'clear', storeOp:'store', clearValue:{r:0,g:0,b:0,a:1} }] });
    background.draw(pass); lines.draw(pass); particles.draw(pass); if (trails.isActive()) trails.draw(pass); pass.end();
    bloom.renderPost(encoder, context.getCurrentTexture().createView()); device.queue.submit([encoder.finish()]);
  }
  return { resize, render, configure(next) { config = { ...config, ...next }; if(next.particleCount) particles.setParticleCount(next.particleCount); if(next.lineCount) lines.setLineCount(next.lineCount); if(next.trailCount) trails.setTrailCount(next.trailCount); }, destroy() { dead = true; device.destroy(); } };
}
