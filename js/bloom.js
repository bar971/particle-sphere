// Post-processing bloom multi-pass: bright-pass -> blur gaussiano separabile (2 iterazioni,
// mezza risoluzione) -> composite additivo con tone mapping ACES.

export async function createBloomPipeline(device, canvasFormat) {
  const code = await fetch('shaders/bloom.wgsl').then((r) => r.text());
  const module = device.createShaderModule({ code });

  const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

  const brightPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'vs_fullscreen' },
    fragment: { module, entryPoint: 'fs_bright', targets: [{ format: 'rgba16float' }] },
    primitive: { topology: 'triangle-list' },
  });

  const blurPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'vs_fullscreen' },
    fragment: { module, entryPoint: 'fs_blur', targets: [{ format: 'rgba16float' }] },
    primitive: { topology: 'triangle-list' },
  });

  const compositePipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'vs_fullscreen' },
    fragment: { module, entryPoint: 'fs_composite', targets: [{ format: canvasFormat }] },
    primitive: { topology: 'triangle-list' },
  });

  let res = {};

  function resize(width, height) {
    if (res.sceneTex) {
      res.sceneTex.destroy();
      res.brightTex.destroy();
      res.blurTexA.destroy();
      res.blurTexB.destroy();
    }

    const hw = Math.max(1, Math.floor(width / 2));
    const hh = Math.max(1, Math.floor(height / 2));

    const sceneTex = device.createTexture({
      size: [width, height],
      format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    const mk = (w, h) =>
      device.createTexture({
        size: [w, h],
        format: 'rgba16float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
    const brightTex = mk(hw, hh);
    const blurTexA = mk(hw, hh);
    const blurTexB = mk(hw, hh);

    res = { sceneTex, brightTex, blurTexA, blurTexB, width, height, hw, hh };

    res.brightUniform = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    res.blurUniformH = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    res.blurUniformV = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    res.blurUniformH2 = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    res.blurUniformV2 = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    res.compositeUniform = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    device.queue.writeBuffer(res.brightUniform, 0, new Float32Array([1 / width, 1 / height, 0, 1.1]));
    device.queue.writeBuffer(res.blurUniformH, 0, new Float32Array([1 / hw, 1 / hh, 0, 0]));
    device.queue.writeBuffer(res.blurUniformV, 0, new Float32Array([1 / hw, 1 / hh, 2, 0]));
    device.queue.writeBuffer(res.blurUniformH2, 0, new Float32Array([1 / hw, 1 / hh, 0, 0]));
    device.queue.writeBuffer(res.blurUniformV2, 0, new Float32Array([1 / hw, 1 / hh, 2, 0]));
    device.queue.writeBuffer(res.compositeUniform, 0, new Float32Array([0.7, 1.4, 0.85, 0]));

    res.brightBindGroup = device.createBindGroup({
      layout: brightPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sceneTex.createView() },
        { binding: 1, resource: sampler },
        { binding: 2, resource: { buffer: res.brightUniform } },
      ],
    });
    res.blurBindGroupH = device.createBindGroup({
      layout: blurPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: brightTex.createView() },
        { binding: 1, resource: sampler },
        { binding: 2, resource: { buffer: res.blurUniformH } },
      ],
    });
    res.blurBindGroupV = device.createBindGroup({
      layout: blurPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: blurTexA.createView() },
        { binding: 1, resource: sampler },
        { binding: 2, resource: { buffer: res.blurUniformV } },
      ],
    });
    res.blurBindGroupH2 = device.createBindGroup({
      layout: blurPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: blurTexB.createView() },
        { binding: 1, resource: sampler },
        { binding: 2, resource: { buffer: res.blurUniformH2 } },
      ],
    });
    res.blurBindGroupV2 = device.createBindGroup({
      layout: blurPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: blurTexA.createView() },
        { binding: 1, resource: sampler },
        { binding: 2, resource: { buffer: res.blurUniformV2 } },
      ],
    });
    res.compositeBindGroup = device.createBindGroup({
      layout: compositePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sceneTex.createView() },
        { binding: 1, resource: blurTexB.createView() },
        { binding: 2, resource: sampler },
        { binding: 3, resource: { buffer: res.compositeUniform } },
      ],
    });
  }

  function runFullscreenPass(encoder, pipeline, bindGroup, targetView) {
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        { view: targetView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
  }

  function renderPost(encoder, canvasView) {
    runFullscreenPass(encoder, brightPipeline, res.brightBindGroup, res.brightTex.createView());
    runFullscreenPass(encoder, blurPipeline, res.blurBindGroupH, res.blurTexA.createView());
    runFullscreenPass(encoder, blurPipeline, res.blurBindGroupV, res.blurTexB.createView());
    runFullscreenPass(encoder, blurPipeline, res.blurBindGroupH2, res.blurTexA.createView());
    runFullscreenPass(encoder, blurPipeline, res.blurBindGroupV2, res.blurTexB.createView());
    runFullscreenPass(encoder, compositePipeline, res.compositeBindGroup, canvasView);
  }

  return {
    resize,
    renderPost,
    getSceneView() {
      return res.sceneTex.createView();
    },
  };
}
