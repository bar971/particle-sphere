import { mat4Multiply, mat4Perspective, mat4LookAt } from './math.js';
import { createParticleSystem, SPHERE_RADIUS } from './particles.js';
import { createLineSystem } from './lines.js';
import { createTrailSystem } from './trail.js';
import { createBloomPipeline } from './bloom.js';
import { createBackgroundPipeline } from './background.js';

const LOOP_PERIOD = 20.0; // secondi: periodo di loop seamless
const SCENE_FORMAT = 'rgba16float';

function showFallback() {
  const fallback = document.getElementById('fallback');
  const canvas = document.getElementById('gpu-canvas');
  fallback.style.display = 'flex';
  canvas.style.display = 'none';
}

async function init() {
  if (!navigator.gpu) {
    showFallback();
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    showFallback();
    return;
  }
  const device = await adapter.requestDevice();

  const canvas = document.getElementById('gpu-canvas');
  const context = canvas.getContext('webgpu');
  if (!context) {
    showFallback();
    return;
  }
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

  const uniformBuffer = device.createBuffer({
    size: 112, // mat4x4 (64) + camRight (16) + camUp (16) + params (16)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const [particleSystem, lineSystem, trailSystem, bloomFx, backgroundFx] = await Promise.all([
    createParticleSystem(device, uniformBuffer, SCENE_FORMAT),
    createLineSystem(device, uniformBuffer, SCENE_FORMAT, SPHERE_RADIUS),
    createTrailSystem(device, uniformBuffer, SCENE_FORMAT, SPHERE_RADIUS),
    createBloomPipeline(device, canvasFormat),
    createBackgroundPipeline(device, SCENE_FORMAT),
  ]);

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    context.configure({ device, format: canvasFormat, alphaMode: 'opaque' });
    bloomFx.resize(w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  const startTime = performance.now();
  const uniformData = new Float32Array(28);

  function frame() {
    resize();

    const rawTSec = (performance.now() - startTime) / 1000; // tempo assoluto, non modulo: usato solo per lo scheduling della scia
    const tSec = rawTSec % LOOP_PERIOD;
    const phase = (tSec / LOOP_PERIOD) * Math.PI * 2;

    trailSystem.update(rawTSec);

    const eye = [0, 0, 3.2];
    const view = mat4LookAt(eye, [0, 0, 0], [0, 1, 0]);
    const aspect = canvas.width / canvas.height;
    const proj = mat4Perspective((45 * Math.PI) / 180, aspect, 0.1, 100);
    const viewProj = mat4Multiply(proj, view);

    uniformData.set(viewProj, 0);
    uniformData.set([1, 0, 0, 0], 16); // camRight (camera fissa, assi mondo)
    uniformData.set([0, 1, 0, 0], 20); // camUp
    uniformData.set([tSec, phase, 0.018, aspect], 24);
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);
    backgroundFx.setAspect(aspect);

    const encoder = device.createCommandEncoder();

    const computePass = encoder.beginComputePass();
    particleSystem.update(computePass);
    computePass.end();

    const scenePass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: bloomFx.getSceneView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
        },
      ],
    });
    backgroundFx.draw(scenePass);
    lineSystem.draw(scenePass);
    particleSystem.draw(scenePass);
    if (trailSystem.isActive()) trailSystem.draw(scenePass);
    scenePass.end();

    bloomFx.renderPost(encoder, context.getCurrentTexture().createView());

    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

init();
