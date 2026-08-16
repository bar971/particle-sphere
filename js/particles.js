// Sistema particelle: distribuzione Fibonacci-sphere, compute pipeline (curl-noise + rotazione),
// render pipeline a billboard instanced con additive blending.

export const PARTICLE_COUNT = 40000;
export const SPHERE_RADIUS = 1.0;

function fibonacciSphere(n, radius) {
  const points = new Float32Array(n * 4);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    points[i * 4 + 0] = x * radius;
    points[i * 4 + 1] = y * radius;
    points[i * 4 + 2] = z * radius;
    points[i * 4 + 3] = 1;
  }
  return points;
}

export async function createParticleSystem(device, uniformBuffer, sceneFormat, initialCount = PARTICLE_COUNT) {
  let currentCount = initialCount;
  let baseBuffer = null;
  let outBuffer = null;
  let computeBindGroup = null;
  let renderBindGroup = null;

  const [computeCode, renderCode] = await Promise.all([
    fetch('shaders/particles.compute.wgsl').then((r) => r.text()),
    fetch('shaders/particles.render.wgsl').then((r) => r.text()),
  ]);

  const computeModule = device.createShaderModule({ code: computeCode });
  const renderModule = device.createShaderModule({ code: renderCode });

  const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: computeModule, entryPoint: 'main' },
  });

  const renderPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: renderModule, entryPoint: 'vs_main' },
    fragment: {
      module: renderModule,
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

  function allocateBuffers(count) {
    if (baseBuffer) {
      baseBuffer.destroy();
    }
    if (outBuffer) {
      outBuffer.destroy();
    }

    currentCount = count;
    const basePositions = fibonacciSphere(currentCount, SPHERE_RADIUS);

    baseBuffer = device.createBuffer({
      size: basePositions.byteLength,
      usage: GPUBufferUsage.STORAGE,
      mappedAtCreation: true,
    });
    new Float32Array(baseBuffer.getMappedRange()).set(basePositions);
    baseBuffer.unmap();

    outBuffer = device.createBuffer({
      size: currentCount * 8 * 4, // vec4 pos + vec4 color
      usage: GPUBufferUsage.STORAGE,
    });

    computeBindGroup = device.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: baseBuffer } },
        { binding: 2, resource: { buffer: outBuffer } },
      ],
    });

    renderBindGroup = device.createBindGroup({
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: outBuffer } },
      ],
    });
  }

  allocateBuffers(currentCount);

  return {
    setParticleCount(newCount) {
      if (typeof newCount === 'number' && newCount > 0 && newCount !== currentCount) {
        allocateBuffers(Math.floor(newCount));
      }
    },
    getParticleCount() {
      return currentCount;
    },
    update(computePass) {
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      computePass.dispatchWorkgroups(Math.ceil(currentCount / 64));
    },
    draw(renderPass) {
      renderPass.setPipeline(renderPipeline);
      renderPass.setBindGroup(0, renderBindGroup);
      renderPass.draw(4, currentCount);
    },
  };
}
