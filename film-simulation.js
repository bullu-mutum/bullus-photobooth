/**
 * film-simulation.js
 * WebGL-accelerated implementation of mathematical film curves
 * (Kodak 200, Fujifilm C200, B&W Tri-X)
 */

const filmPresets = {
  kodak200: { name: "KODAK GOLD 200", short: "KODAK", id: 1 },
  fuji200: { name: "FUJIFILM C200", short: "FUJI", id: 2 },
  bw: { name: "B&W TRI-X", short: "B&W", id: 3 },
  none: { name: "NORMAL", short: "NORMAL", id: 0 }
};

let currentPresetId = 1;

// --- WebGL Shader Engine ---

const vsSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const fsSource = `
  precision highp float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;
  uniform int u_preset;
  uniform float u_time;
  
  // Math Helpers
  float liftShadows(float x, float lift) {
      return lift + x * (1.0 - lift);
  }
  
  float contrast(float x, float amount) {
      return 0.5 + (x - 0.5) * (1.0 + amount);
  }
  
  float softHighlights(float x, float amount) {
      return x - amount * x * x * x;
  }
  
  vec3 applySaturation(vec3 color, float s) {
      float l = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
      return vec3(l) + (color - vec3(l)) * s;
  }
  
  // Hash for film grain
  float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  void main() {
    vec4 texColor = texture2D(u_image, v_texCoord);
    vec3 c = texColor.rgb;
    
    if (u_preset == 1) { // KODAK 200
        c.r = liftShadows(c.r, 0.06);
        c.r = contrast(c.r, 0.12);
        c.r = c.r * 1.04 + 0.02;
        c.r = softHighlights(c.r, 0.05);
        
        c.g = liftShadows(c.g, 0.05);
        c.g = contrast(c.g, 0.10);
        c.g = c.g * 1.01 + 0.01;
        c.g = softHighlights(c.g, 0.05);
        
        c.b = liftShadows(c.b, 0.04);
        c.b = contrast(c.b, 0.10);
        c.b = c.b * 0.95;
        c.b = softHighlights(c.b, 0.06);
        
        // Warmth
        c.r = clamp(c.r + 4.0/255.0, 0.0, 1.0);
        c.b = clamp(c.b - 4.0/255.0, 0.0, 1.0);
        
        // Saturation
        c = applySaturation(c, 1.08);
        
        // Grain
        float n = (random(v_texCoord * (u_time + 1.0)) - 0.5) * (8.0/255.0);
        c += n;
        
    } else if (u_preset == 2) { // FUJI C200
        c.r = liftShadows(c.r, 0.02);
        c.r = contrast(c.r, 0.18);
        c.r = c.r * 1.03;
        c.r = softHighlights(c.r, 0.04);
        
        c.g = liftShadows(c.g, 0.02);
        c.g = contrast(c.g, 0.18);
        c.g = c.g * 1.05 + 0.005;
        c.g = softHighlights(c.g, 0.04);
        
        c.b = liftShadows(c.b, 0.03);
        c.b = contrast(c.b, 0.16);
        c.b = c.b * 1.01 + 0.01;
        c.b = softHighlights(c.b, 0.03);
        
        // Cool/Warmth
        c.r = clamp(c.r - 3.0/255.0, 0.0, 1.0);
        c.b = clamp(c.b + 3.0/255.0, 0.0, 1.0);
        
        // Saturation
        c = applySaturation(c, 1.14);
        
        // Grain
        float n = (random(v_texCoord * (u_time + 1.0)) - 0.5) * (6.0/255.0);
        c += n;
        
    } else if (u_preset == 3) { // B&W
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        l = contrast(l, 0.25);
        c = vec3(l);
        float n = (random(v_texCoord * (u_time + 1.0)) - 0.5) * (10.0/255.0);
        c += n;
    }

    gl_FragColor = vec4(clamp(c, 0.0, 1.0), texColor.a);
  }
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vs, fs) {
  const program = gl.createProgram();
  gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program);
  return program;
}

let engine = null;

function initEngine(canvas) {
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
  if (!gl) return null;
  
  // Flip WebGL texture Y so standard drawing results in a right-side-up image
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const program = createProgram(gl, vsSource, fsSource);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  // Standard Quad
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,-1,  1,-1,  -1,1,  1,1
  ]), gl.STATIC_DRAW);

  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
     0,0,   1,0,   0,1,   1,1
  ]), gl.STATIC_DRAW);

  const videoTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, videoTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  engine = {
    gl,
    program,
    positionBuffer,
    texCoordBuffer,
    videoTexture
  };
}

function renderFrame(video) {
  if (!engine) return;
  const { gl, program, positionBuffer, texCoordBuffer, videoTexture } = engine;
  
  const w = gl.canvas.width;
  const h = gl.canvas.height;
  
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, videoTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

  gl.viewport(0, 0, w, h);
  gl.useProgram(program);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const posLoc = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  const texLoc = gl.getAttribLocation(program, "a_texCoord");
  gl.enableVertexAttribArray(texLoc);
  gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

  gl.uniform1i(gl.getUniformLocation(program, "u_image"), 0);
  gl.uniform1i(gl.getUniformLocation(program, "u_preset"), currentPresetId);
  gl.uniform1f(gl.getUniformLocation(program, "u_time"), performance.now() / 1000.0);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// --- WebRTC Interception ---

const originalGetUserMedia = navigator.mediaDevices ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices) : null;

if (originalGetUserMedia) {
  navigator.mediaDevices.getUserMedia = async function(constraints) {
    const stream = await originalGetUserMedia(constraints);
    if (!constraints.video) return stream;

    const rawVideo = document.createElement("video");
    rawVideo.srcObject = stream;
    rawVideo.muted = true;
    rawVideo.playsInline = true;
    await rawVideo.play();

    const processCanvas = document.createElement("canvas");
    processCanvas.width = 1280;
    processCanvas.height = 960;
    
    initEngine(processCanvas);

    function renderLoop() {
      if (rawVideo.readyState >= 2) {
        if (processCanvas.width !== rawVideo.videoWidth && rawVideo.videoWidth > 0) {
           processCanvas.width = rawVideo.videoWidth;
           processCanvas.height = rawVideo.videoHeight;
        }
        renderFrame(rawVideo);
      }
      requestAnimationFrame(renderLoop);
    }
    renderLoop();

    const processedStream = processCanvas.captureStream(30);
    if (constraints.audio) {
      stream.getAudioTracks().forEach(track => processedStream.addTrack(track));
    }

    return processedStream;
  };
}

// --- UI Injection ---

function createFilmSelectorUI() {
  const container = document.createElement("div");
  container.className = "film-selector-container";
  
  const title = document.createElement("div");
  title.className = "film-selector-title";
  title.innerText = "FILM SIMULATION";
  container.appendChild(title);

  const buttonGroup = document.createElement("div");
  buttonGroup.className = "film-selector-buttons";
  
  Object.keys(filmPresets).forEach(key => {
    const preset = filmPresets[key];
    const btn = document.createElement("button");
    btn.className = "film-btn" + (preset.id === currentPresetId ? " active" : "");
    btn.type = "button";
    btn.setAttribute("aria-label", preset.name);
    // full film name on wide screens, a short one on phones
    const full = document.createElement("span");
    full.className = "film-btn__full";
    full.textContent = preset.name;
    const short = document.createElement("span");
    short.className = "film-btn__short";
    short.textContent = preset.short;
    btn.append(full, short);
    btn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      currentPresetId = preset.id;
      Array.from(buttonGroup.children).forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    };
    buttonGroup.appendChild(btn);
  });
  
  container.appendChild(buttonGroup);
  return container;
}

const observer = new MutationObserver((mutations) => {
  for (let mutation of mutations) {
    if (mutation.addedNodes.length) {
      const captureScreen = document.getElementById("capture-screen");
      if (captureScreen && !document.querySelector(".film-selector-container")) {
        const ui = createFilmSelectorUI();
        const cameraWrapper = captureScreen.querySelector(".capture__camera-wrapper");
        if (cameraWrapper) {
          // Sits under the photo, not on top of it, so the picture stays clear.
          ui.setAttribute("role", "group");
          ui.setAttribute("aria-label", "Film simulation");
          cameraWrapper.insertAdjacentElement("afterend", ui);
        }
      }
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  observer.observe(document.body, { childList: true, subtree: true });
});
