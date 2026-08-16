// Pannello di controllo UI (Vanilla Glassmorphism) per il tweaking in tempo reale dei parametri WebGPU.

export const defaultParams = {
  // Post-processing & Bloom
  bloomIntensity: 0.7,
  bloomThreshold: 1.1,
  exposure: 0.85,
  vignette: 1.4,
  // Simulazione e Particelle
  particleCount: 40000,
  rotationSpeed: 1.0,
  spriteSize: 0.018,
  // Linee e Scie
  showLines: true,
  lineCount: 40,
  showTrails: true,
};

export const params = { ...defaultParams };

const listeners = [];

export function onParamChange(cb) {
  listeners.push(cb);
}

function notifyChange(key, value) {
  params[key] = value;
  for (const cb of listeners) {
    cb(key, value, params);
  }
}

export function initGUI() {
  // Iniezione degli stili CSS per la GUI
  const style = document.createElement('style');
  style.textContent = `
    #gui-container {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 1000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      color: #e0e0e0;
      user-select: none;
    }
    #gui-toggle-btn {
      position: fixed;
      top: 16px;
      right: 16px;
      width: 36px;
      height: 36px;
      background: rgba(20, 16, 42, 0.7);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 1001;
      transition: all 0.2s ease;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    }
    #gui-toggle-btn:hover {
      background: rgba(255, 0, 128, 0.3);
      border-color: rgba(255, 0, 128, 0.5);
    }
    #gui-panel {
      width: 270px;
      background: rgba(12, 10, 24, 0.82);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
      transform-origin: top right;
    }
    #gui-panel.collapsed {
      transform: scale(0.9);
      opacity: 0;
      pointer-events: none;
    }
    .gui-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 8px;
      font-weight: 600;
      letter-spacing: 0.5px;
      color: #ff007f;
      text-transform: uppercase;
      font-size: 11px;
    }
    .gui-section-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #00e5ff;
      margin-top: 4px;
      margin-bottom: 2px;
      font-weight: 700;
    }
    .gui-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .gui-label {
      flex: 1;
      color: #b0b0cc;
      font-size: 11.5px;
    }
    .gui-val {
      width: 38px;
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-family: monospace;
      color: #fff;
      font-size: 11px;
    }
    .gui-slider {
      flex: 1.2;
      height: 4px;
      -webkit-appearance: none;
      appearance: none;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 2px;
      outline: none;
    }
    .gui-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #ff007f;
      cursor: pointer;
      box-shadow: 0 0 8px rgba(255, 0, 128, 0.8);
      transition: transform 0.1s ease;
    }
    .gui-slider::-webkit-slider-thumb:hover {
      transform: scale(1.25);
      background: #00e5ff;
      box-shadow: 0 0 10px rgba(0, 229, 255, 0.9);
    }
    .gui-checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      color: #b0b0cc;
    }
    .gui-checkbox {
      accent-color: #ff007f;
      cursor: pointer;
    }
    .gui-btn-reset {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      color: #eee;
      padding: 6px 10px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s ease;
      width: 100%;
      margin-top: 4px;
      font-weight: 500;
    }
    .gui-btn-reset:hover {
      background: rgba(255, 0, 128, 0.2);
      border-color: rgba(255, 0, 128, 0.4);
      color: #fff;
    }
    .gui-shortcut-tip {
      font-size: 9.5px;
      color: #707090;
      text-align: center;
      margin-top: -4px;
    }
  `;
  document.head.appendChild(style);

  // Creazione elementi DOM
  const container = document.createElement('div');
  container.id = 'gui-container';

  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'gui-toggle-btn';
  toggleBtn.title = 'Mostra/Nascondi Controlli (H)';
  toggleBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  `;

  const panel = document.createElement('div');
  panel.id = 'gui-panel';

  panel.innerHTML = `
    <div class="gui-header">
      <span>Controlli WebGPU</span>
      <span style="font-size: 10px; color: #888;">Live Tweaking</span>
    </div>

    <!-- Sezione Post-Processing & Bloom -->
    <div class="gui-section-title">Post-Processing</div>
    
    <div class="gui-row">
      <span class="gui-label">Bloom Int.</span>
      <input type="range" class="gui-slider" id="param-bloomIntensity" min="0" max="2.5" step="0.05" value="${params.bloomIntensity}">
      <span class="gui-val" id="val-bloomIntensity">${params.bloomIntensity.toFixed(2)}</span>
    </div>

    <div class="gui-row">
      <span class="gui-label">Soglia Bloom</span>
      <input type="range" class="gui-slider" id="param-bloomThreshold" min="0.2" max="2.5" step="0.05" value="${params.bloomThreshold}">
      <span class="gui-val" id="val-bloomThreshold">${params.bloomThreshold.toFixed(2)}</span>
    </div>

    <div class="gui-row">
      <span class="gui-label">Esposizione</span>
      <input type="range" class="gui-slider" id="param-exposure" min="0.2" max="2.0" step="0.05" value="${params.exposure}">
      <span class="gui-val" id="val-exposure">${params.exposure.toFixed(2)}</span>
    </div>

    <div class="gui-row">
      <span class="gui-label">Vignettatura</span>
      <input type="range" class="gui-slider" id="param-vignette" min="0.0" max="3.0" step="0.1" value="${params.vignette}">
      <span class="gui-val" id="val-vignette">${params.vignette.toFixed(1)}</span>
    </div>

    <!-- Sezione Animazione & Simulazione -->
    <div class="gui-section-title">Dinamica & Particelle</div>

    <div class="gui-row">
      <span class="gui-label">N. Particelle</span>
      <input type="range" class="gui-slider" id="param-particleCount" min="5000" max="150000" step="5000" value="${params.particleCount}">
      <span class="gui-val" id="val-particleCount">${(params.particleCount / 1000).toFixed(0)}k</span>
    </div>

    <div class="gui-row">
      <span class="gui-label">Velocità Rot.</span>
      <input type="range" class="gui-slider" id="param-rotationSpeed" min="0" max="3.0" step="0.05" value="${params.rotationSpeed}">
      <span class="gui-val" id="val-rotationSpeed">${params.rotationSpeed.toFixed(2)}x</span>
    </div>

    <div class="gui-row">
      <span class="gui-label">Dim. Particelle</span>
      <input type="range" class="gui-slider" id="param-spriteSize" min="0.005" max="0.045" step="0.001" value="${params.spriteSize}">
      <span class="gui-val" id="val-spriteSize">${params.spriteSize.toFixed(3)}</span>
    </div>

    <!-- Sezione Elementi Grafici -->
    <div class="gui-section-title">Elementi</div>

    <div class="gui-row">
      <label class="gui-checkbox-label">
        <input type="checkbox" class="gui-checkbox" id="param-showLines" ${params.showLines ? 'checked' : ''}>
        <span>Linee di Energia</span>
      </label>
    </div>

    <div class="gui-row" style="padding-left: 12px;">
      <span class="gui-label">N. Linee</span>
      <input type="range" class="gui-slider" id="param-lineCount" min="10" max="80" step="2" value="${params.lineCount}">
      <span class="gui-val" id="val-lineCount">${params.lineCount}</span>
    </div>

    <div class="gui-row">
      <label class="gui-checkbox-label">
        <input type="checkbox" class="gui-checkbox" id="param-showTrails" ${params.showTrails ? 'checked' : ''}>
        <span>Scie Luminose</span>
      </label>
    </div>

    <button class="gui-btn-reset" id="gui-btn-reset">Ripristina Valori Predefiniti</button>
    <div class="gui-shortcut-tip">Premi 'H' per nascondere la GUI</div>
  `;

  container.appendChild(panel);
  document.body.appendChild(toggleBtn);
  document.body.appendChild(container);

  // Toggle visibilità pannello
  let isCollapsed = false;
  function togglePanel() {
    isCollapsed = !isCollapsed;
    panel.classList.toggle('collapsed', isCollapsed);
  }

  toggleBtn.addEventListener('click', togglePanel);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H') {
      togglePanel();
    }
  });

  // Binding degli slider
  const sliderConfig = [
    { id: 'bloomIntensity', format: (v) => Number(v).toFixed(2) },
    { id: 'bloomThreshold', format: (v) => Number(v).toFixed(2) },
    { id: 'exposure', format: (v) => Number(v).toFixed(2) },
    { id: 'vignette', format: (v) => Number(v).toFixed(1) },
    { id: 'particleCount', format: (v) => `${(Number(v) / 1000).toFixed(0)}k` },
    { id: 'lineCount', format: (v) => `${Number(v)}` },
    { id: 'rotationSpeed', format: (v) => `${Number(v).toFixed(2)}x` },
    { id: 'spriteSize', format: (v) => Number(v).toFixed(3) },
  ];

  for (const cfg of sliderConfig) {
    const input = document.getElementById(`param-${cfg.id}`);
    const valSpan = document.getElementById(`val-${cfg.id}`);
    input.addEventListener('input', () => {
      const val = parseFloat(input.value);
      valSpan.textContent = cfg.format(val);
      notifyChange(cfg.id, val);
    });
  }

  // Binding checkbox
  const checkboxConfig = ['showLines', 'showTrails'];
  for (const id of checkboxConfig) {
    const input = document.getElementById(`param-${id}`);
    input.addEventListener('change', () => {
      notifyChange(id, input.checked);
    });
  }

  // Reset button
  document.getElementById('gui-btn-reset').addEventListener('click', () => {
    Object.assign(params, defaultParams);
    for (const cfg of sliderConfig) {
      const input = document.getElementById(`param-${cfg.id}`);
      const valSpan = document.getElementById(`val-${cfg.id}`);
      input.value = params[cfg.id];
      valSpan.textContent = cfg.format(params[cfg.id]);
      notifyChange(cfg.id, params[cfg.id]);
    }
    for (const id of checkboxConfig) {
      const input = document.getElementById(`param-${id}`);
      input.checked = params[id];
      notifyChange(id, params[id]);
    }
  });
}
