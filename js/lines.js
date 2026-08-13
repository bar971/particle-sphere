// Linee di energia: spirali procedurali sulla sfera, line-strip additive.
// Il glow viene prodotto dal post-processing bloom, non dalla geometria.

export const LINE_COUNT = 40;
export const POINTS_PER_LINE = 128;

function buildLines(radius) {
  const total = LINE_COUNT * POINTS_PER_LINE;
  const data = new Float32Array(total * 4);
  let idx = 0;
  for (let l = 0; l < LINE_COUNT; l++) {
    const turns = 2 + (l % 5);
    const tiltAxis = (l / LINE_COUNT) * Math.PI * 2;
    const tilt = 0.3 + 0.5 * Math.sin(l * 12.9898);
    for (let p = 0; p < POINTS_PER_LINE; p++) {
      const t = p / (POINTS_PER_LINE - 1);
      const phi = (t - 0.5) * Math.PI * 0.92;
      const theta = t * turns * Math.PI * 2 + tiltAxis;

      const x = Math.cos(phi) * Math.cos(theta);
      let y = Math.sin(phi);
      let z = Math.cos(phi) * Math.sin(theta);

      const ry = y * Math.cos(tilt) - z * Math.sin(tilt);
      const rz = y * Math.sin(tilt) + z * Math.cos(tilt);
      y = ry;
      z = rz;

      const r = radius * 1.01;
      data[idx * 4 + 0] = x * r;
      data[idx * 4 + 1] = y * r;
      data[idx * 4 + 2] = z * r;
      data[idx * 4 + 3] = l + Math.min(t, 0.999);
      idx++;
    }
  }
  return data;
}

export async function createLineSystem(device, uniformBuffer, sceneFormat, sphereRadius) {
  const data = buildLines(sphereRadius);

  const vertexBuffer = device.createBuffer({
    size: data.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(data);
  vertexBuffer.unmap();

  const code = await fetch('shaders/lines.render.wgsl').then((r) => r.text());
  const module = device.createShaderModule({ code });

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs_main',
      buffers: [
        {
          arrayStride: 16,
          attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x4' }],
        },
      ],
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
    primitive: { topology: 'line-strip' },
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  return {
    draw(renderPass) {
      renderPass.setPipeline(pipeline);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.setVertexBuffer(0, vertexBuffer);
      for (let l = 0; l < LINE_COUNT; l++) {
        renderPass.draw(POINTS_PER_LINE, 1, l * POINTS_PER_LINE, 0);
      }
    },
  };
}
