// Sfondo: gradiente radiale scuro blu/viola + stelline statiche fioche.
// Pipeline fullscreen indipendente, disegnata come primo draw call nella scenePass
// (prima di linee e particelle) cosi' la catena bloom esistente resta invariata.

export async function createBackgroundPipeline(device, sceneFormat) {
  const code = await fetch('shaders/background.wgsl').then((r) => r.text());
  const module = device.createShaderModule({ code });

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'vs_fullscreen' },
    fragment: { module, entryPoint: 'fs_background', targets: [{ format: sceneFormat }] },
    primitive: { topology: 'triangle-list' },
  });

  const uniformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  return {
    setAspect(aspect) {
      device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([aspect, 0, 0, 0]));
    },
    draw(renderPass) {
      renderPass.setPipeline(pipeline);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(3);
    },
  };
}
