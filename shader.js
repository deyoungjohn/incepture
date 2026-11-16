/*
 * Background field: domain-warped noise, lit from the top-right corner so the
 * lower-left stays dark for the type. Plain WebGL1, no dependencies.
 */
(() => {
  "use strict";

  const canvas = document.getElementById("field");
  if (!canvas) return;

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

    const vec3 INK     = vec3(0.047, 0.039, 0.035);
    const vec3 SLATE   = vec3(0.075, 0.105, 0.160);
    const vec3 UMBER   = vec3(0.200, 0.082, 0.055);
    const vec3 SIENNA  = vec3(0.560, 0.215, 0.110);
    const vec3 APRICOT = vec3(0.949, 0.596, 0.400);
    const vec3 SAND    = vec3(0.985, 0.860, 0.720);

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
        p = mat2(1.6, 1.2, -1.2, 1.6) * p + 11.7;
        amp *= 0.5;
      }
      return sum;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;
      vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
      float t = uTime * 0.017;

      // Stretch the field along a diagonal so it reads as cloth, not smoke.
      vec2 st = mat2(0.82, -0.57, 0.57, 0.82) * p;
      st = st * vec2(0.85, 1.55) + uPointer * 0.05;

      vec2 q = vec2(
        fbm(st + vec2(0.0, t)),
        fbm(st + vec2(5.2, 1.3) - vec2(t, 0.0))
      );
      vec2 r = vec2(
        fbm(st + 3.2 * q + vec2(1.7, 9.2) + 1.3 * t),
        fbm(st + 3.2 * q + vec2(8.3, 2.8) - 1.1 * t)
      );
      float f = fbm(st + 3.4 * r);

      // Light falls off from the top-right corner.
      vec2 corner = vec2(1.0, 1.0) + uPointer * 0.04;
      float d = length((uv - corner) * vec2(1.0, 0.92));
      float light = smoothstep(1.18, 0.12, d);
      light *= light;

      // Folds: broad body from the warp, a sharper crest where it turns over.
      float body = smoothstep(0.22, 0.78, f);
      float crest = pow(clamp(1.0 - abs(r.x - r.y) * 3.2, 0.0, 1.0), 3.0);
      float v = body * (0.10 + 0.90 * light) + crest * 0.34 * light;
      v *= 0.52 + 0.62 * light;

      vec3 col = INK;
      col = mix(col, SLATE, smoothstep(0.30, 0.75, q.y) * (0.30 + 0.45 * (1.0 - light)));
      col = mix(col, UMBER, smoothstep(0.02, 0.28, v));
      col = mix(col, SIENNA, smoothstep(0.22, 0.56, v));
      col = mix(col, APRICOT, smoothstep(0.52, 0.86, v));
      col = mix(col, SAND, smoothstep(0.88, 1.16, v) * 0.85);

      // Settle the edges, then dither to keep the dark gradients from banding.
      float vig = smoothstep(1.45, 0.35, length(uv - vec2(0.62, 0.58)) * 1.25);
      col *= 0.72 + 0.28 * vig;
      col += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) * 0.022;

      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `;

  const MAX_DPR = 1.5;
  const MAX_PIXELS = 2.4e6;
  const FRAME_MS = 30; // ~30fps is plenty for motion this slow
  const TIME_OFFSET = 37; // start somewhere with good composition

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  let gl = null;
  let uniforms = null;
  let quality = 1;
  let raf = 0;
  let lastFrame = 0;
  let clock = 0; // seconds of animation actually shown
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

    // One oversized triangle covers the viewport.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    uniforms = {
      res: gl.getUniformLocation(program, "uRes"),
      time: gl.getUniformLocation(program, "uTime"),
      pointer: gl.getUniformLocation(program, "uPointer"),
    };
    return true;
  }

  function resize() {
    const cssW = canvas.clientWidth || window.innerWidth;
    const cssH = canvas.clientHeight || window.innerHeight;
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
    gl.uniform2f(uniforms.pointer, pointer.x, pointer.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!live) {
      live = true;
      canvas.classList.add("is-live");
    }
  }

  // If the device can't hold the frame rate, render fewer pixels instead.
  function tune(delta) {
    sampled += 1;
    if (delta > 48) slowFrames += 1;
    if (sampled < 40) return;
    if (slowFrames > 20 && quality > 0.4) {
      quality = Math.max(0.4, quality * 0.72);
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

    // A long gap means the tab was in the background: don't jump, don't measure.
    if (delta < 250) {
      clock += delta / 1000;
      tune(delta);
    }

    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;
    draw();
  }

  function start() {
    cancelAnimationFrame(raf);
    raf = 0;
    if (!gl || gl.isContextLost()) return;
    resize();
    if (reducedMotion.matches || document.hidden) {
      draw(); // a single still frame
      return;
    }
    lastFrame = performance.now() - FRAME_MS;
    raf = requestAnimationFrame(frame);
  }

  function boot() {
    try {
      if (!setup()) return;
    } catch (error) {
      console.warn("[incepture] background shader disabled:", error);
      gl = null;
      return;
    }
    start();
  }

  window.addEventListener("resize", () => {
    if (!gl || gl.isContextLost()) return;
    resize();
    if (!raf) draw();
  });

  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return;
      pointer.tx = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = 1 - (event.clientY / window.innerHeight) * 2;
    },
    { passive: true }
  );

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
