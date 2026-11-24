/*
 * Hero contour plate: domain-warped topographic field in plain WebGL1.
 * Adapts smoothly between Alabaster Light and Obsidian Dark themes and
 * warps gently around the user's pointer.
 */
(() => {
  "use strict";

  const canvas = document.getElementById("field");
  if (!canvas) return;

  const frameEl = canvas.parentElement;
  const coordsEl = document.getElementById("plate-coords");

  const VERT = `
    attribute vec2 aPos;
    void main() {
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif

    uniform vec2 uRes;
    uniform float uTime;
    uniform vec2 uPointer;
    uniform float uTheme; // 0.0 = light alabaster, 1.0 = dark obsidian

    // Light palette: warm paper, stone shadow, terracotta ridge, ink contour
    const vec3 L_PAPER  = vec3(0.933, 0.914, 0.875);
    const vec3 L_STONE  = vec3(0.845, 0.812, 0.758);
    const vec3 L_CLAY   = vec3(0.840, 0.560, 0.430);
    const vec3 L_TERRA  = vec3(0.784, 0.294, 0.157);
    const vec3 L_INK    = vec3(0.115, 0.105, 0.095);

    // Dark palette: warm obsidian, deep slate, umber, ember ridge, bone contour
    const vec3 D_INK    = vec3(0.067, 0.063, 0.059);
    const vec3 D_SLATE  = vec3(0.110, 0.125, 0.155);
    const vec3 D_UMBER  = vec3(0.280, 0.125, 0.085);
    const vec3 D_EMBER  = vec3(0.910, 0.510, 0.330);
    const vec3 D_BONE   = vec3(0.955, 0.915, 0.865);

    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    float fbm(vec2 p) {
      float sum = 0.0;
      float amp = 0.5;
      for (int i = 0; i < 5; i++) {
        sum += amp * noise(p);
        p = mat2(1.6, 1.2, -1.2, 1.6) * p + 9.3;
        amp *= 0.5;
      }
      return sum;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;
      vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
      float t = uTime * 0.032;

      // Subtle radial pointer warp
      vec2 ptr = uPointer * 0.42;
      float ptrDist = length(p - ptr);
      vec2 pull = (p - ptr) * exp(-ptrDist * 2.6) * 0.22;

      vec2 st = mat2(0.86, -0.51, 0.51, 0.86) * (p - pull);
      st = st * vec2(1.15, 1.35);

      vec2 q = vec2(
        fbm(st + vec2(0.0, t)),
        fbm(st + vec2(4.6, 1.8) - vec2(t * 0.8, 0.0))
      );
      vec2 r = vec2(
        fbm(st + 2.6 * q + vec2(1.9, 7.4) + 0.9 * t),
        fbm(st + 2.6 * q + vec2(6.8, 2.3) - 0.7 * t)
      );
      float h = fbm(st + 2.8 * r);

      // Topographic elevation bands (sharp architectural contour lines)
      float bands = h * 11.5;
      float bandFrac = abs(fract(bands - 0.5) - 0.5);
      float contour = 1.0 - smoothstep(0.018, 0.058, bandFrac);

      // Secondary major contour every 3rd band
      float majorBands = h * 3.833;
      float majorFrac = abs(fract(majorBands - 0.5) - 0.5);
      float majorContour = 1.0 - smoothstep(0.012, 0.042, majorFrac);

      // Directional sculptural light from top-right
      float light = smoothstep(1.25, 0.1, length((uv - vec2(0.82, 0.85)) * vec2(1.0, 0.95)));
      float ridge = smoothstep(0.35, 0.80, h) * (0.35 + 0.65 * light);

      // Light mode composition
      vec3 lightCol = mix(L_PAPER, L_STONE, smoothstep(0.25, 0.72, q.x) * 0.65);
      lightCol = mix(lightCol, L_CLAY, smoothstep(0.42, 0.78, ridge) * 0.55);
      lightCol = mix(lightCol, L_TERRA, smoothstep(0.68, 0.94, ridge) * 0.72);
      lightCol = mix(lightCol, L_INK, contour * 0.16 + majorContour * 0.28);

      // Dark mode composition
      vec3 darkCol = mix(D_INK, D_SLATE, smoothstep(0.28, 0.78, q.y) * 0.42);
      darkCol = mix(darkCol, D_UMBER, smoothstep(0.28, 0.64, ridge) * 0.78);
      darkCol = mix(darkCol, D_EMBER, smoothstep(0.60, 0.92, ridge) * 0.88);
      darkCol = mix(darkCol, D_BONE, contour * 0.18 + majorContour * 0.36);

      // Keep light/dark crossfade crisp using smoothstep on uTheme
      vec3 col = mix(lightCol, darkCol, smoothstep(0.0, 1.0, uTheme));

      // Gentle paper/film grain so gradients stay tactile and band-free
      col += (hash(gl_FragCoord.xy + fract(uTime) * 43.0) - 0.5) * 0.024;

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `;

  const MAX_DPR = 1.75;
  const MAX_PIXELS = 1.8e6;
  const FRAME_MS = 28;
  const TIME_OFFSET = 24;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  function currentThemeTarget() {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "dark") return 1;
    if (attr === "light") return 0;
    return systemDark.matches ? 1 : 0;
  }

  const state = {
    px: 0,
    py: 0,
    tx: 0,
    ty: 0,
    theme: currentThemeTarget(),
    themeTarget: currentThemeTarget(),
  };

  let gl = null;
  let uniforms = null;
  let quality = 1;
  let raf = 0;
  let lastFrame = 0;
  let clock = 0;
  let slowFrames = 0;
  let sampled = 0;
  let live = false;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(log || "Shader failed to compile");
    }
    return shader;
  }

  function setup() {
    gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) return false;

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "Program failed to link");
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    uniforms = {
      res: gl.getUniformLocation(program, "uRes"),
      time: gl.getUniformLocation(program, "uTime"),
      pointer: gl.getUniformLocation(program, "uPointer"),
      theme: gl.getUniformLocation(program, "uTheme"),
    };
    return true;
  }

  function resize() {
    const cssW = canvas.clientWidth || 480;
    const cssH = canvas.clientHeight || 540;
    let scale = Math.min(window.devicePixelRatio || 1, MAX_DPR) * quality;
    const pixels = cssW * cssH * scale * scale;
    if (pixels > MAX_PIXELS) scale *= Math.sqrt(MAX_PIXELS / pixels);

    const w = Math.max(1, Math.round(cssW * scale));
    const h = Math.max(1, Math.round(cssH * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
  }

  function draw() {
    gl.uniform2f(uniforms.res, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, TIME_OFFSET + clock);
    gl.uniform2f(uniforms.pointer, state.px, state.py);
    gl.uniform1f(uniforms.theme, state.theme);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!live) {
      live = true;
      canvas.classList.add("is-live");
    }
  }

  function tune(delta) {
    sampled += 1;
    if (delta > 48) slowFrames += 1;
    if (sampled < 40) return;
    if (slowFrames > 20 && quality > 0.45) {
      quality = Math.max(0.45, quality * 0.75);
      resize();
    }
    sampled = 0;
    slowFrames = 0;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const delta = now - lastFrame;
    if (delta < FRAME_MS) return;
    lastFrame = now;

    if (delta < 250) {
      clock += delta / 1000;
      tune(delta);
    }

    state.px += (state.tx - state.px) * 0.1;
    state.py += (state.ty - state.py) * 0.1;
    const themeDiff = state.themeTarget - state.theme;
    if (Math.abs(themeDiff) < 0.005) {
      state.theme = state.themeTarget;
    } else {
      state.theme += themeDiff * 0.28;
    }
    draw();
  }

  function start() {
    cancelAnimationFrame(raf);
    raf = 0;
    if (!gl || gl.isContextLost()) return;
    resize();
    if (reducedMotion.matches || document.hidden) {
      state.theme = state.themeTarget;
      draw();
      return;
    }
    lastFrame = performance.now() - FRAME_MS;
    raf = requestAnimationFrame(frame);
  }

  function boot() {
    try {
      if (!setup()) return;
    } catch (error) {
      console.warn("[incepture] contour shader disabled:", error);
      gl = null;
      return;
    }
    start();
  }

  function formatCoord(n) {
    const sign = n >= 0 ? "+" : "-";
    return sign + Math.abs(n).toFixed(2);
  }

  if (frameEl) {
    frameEl.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerType === "touch") return;
        const rect = frameEl.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = 1 - ((event.clientY - rect.top) / rect.height) * 2;
        state.tx = Math.max(-1, Math.min(1, nx));
        state.ty = Math.max(-1, Math.min(1, ny));
        if (coordsEl) {
          coordsEl.textContent = `${formatCoord(state.tx)}, ${formatCoord(state.ty)}`;
        }
      },
      { passive: true }
    );

    frameEl.addEventListener(
      "pointerleave",
      () => {
        state.tx = 0;
        state.ty = 0;
        if (coordsEl) {
          coordsEl.textContent = "0.00, 0.00";
        }
      },
      { passive: true }
    );
  }

  window.addEventListener("incepture:theme", (event) => {
    state.themeTarget = event.detail && event.detail.theme === "dark" ? 1 : 0;
    if (reducedMotion.matches && gl && !gl.isContextLost()) {
      state.theme = state.themeTarget;
      draw();
    }
  });

  window.addEventListener("resize", () => {
    if (!gl || gl.isContextLost()) return;
    resize();
    if (!raf) draw();
  });

  document.addEventListener("visibilitychange", start);
  reducedMotion.addEventListener("change", start);

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    cancelAnimationFrame(raf);
    raf = 0;
  });
  canvas.addEventListener("webglcontextrestored", boot);

  boot();
})();
