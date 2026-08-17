(()=>{
  const CHARS = " .:-=+*#%@"; // depth characters from light to dark
  const cellSizeDefault = 12;

  // Perlin noise implementation
  const p = new Uint8Array(512);
  (function buildPerm(){
    const permutation = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102, 143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127, 4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
    for(let i=0;i<512;i++) p[i]=permutation[i & 255];
  })();

  function fade(t){return t*t*t*(t*(t*6-15)+10)}
  function lerp(t,a,b){return a + t*(b-a)}
  function grad(hash, x, y){
    const h = hash & 7;
    const u = h<4 ? x : y;
    const v = h<4 ? y : x;
    return ((h&1)? -u : u) + ((h&2)? -2.0*v : 2.0*v);
  }



  function perlin2(x,y){
    const X = x | 0;
    const Y = y | 0;
    const xf = x - X;
    const yf = y - Y;
    const xi = X & 255;
    const yi = Y & 255;
    const bottomLeft = p[p[xi] + yi];
    const bottomRight = p[p[xi + 1] + yi];
    const topLeft = p[p[xi] + yi + 1];
    const topRight = p[p[xi + 1] + yi + 1];

    const u = fade(xf);
    const v = fade(yf);

    const x1 = lerp(u, grad(bottomLeft, xf, yf), grad(bottomRight, xf - 1, yf));
    const x2 = lerp(u, grad(topLeft, xf, yf - 1), grad(topRight, xf - 1, yf - 1));
    return lerp(v, x1, x2) * 0.5; // about -1..1
  }

  function createCanvas(){
    const root = document.createElement('div');
    root.id = 'ascii-bg-root';
    const canvas = document.createElement('canvas');
    canvas.id = 'ascii-bg-canvas';
    canvas.style.display = 'block';
    canvas.style.imageRendering = 'pixelated';
    root.appendChild(canvas);
    document.body.appendChild(root);
    return canvas;
  }

  function compileShader(gl, type, source){
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader compile failed: ' + info);
    }
    return shader;
  }

  function createProgram(gl, vsSource, fsSource){
    const program = gl.createProgram();
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error('Program link failed: ' + info);
    }
    return program;
  }

  function createCharAtlasTexture(gl, chars, cellSize){
    const charCount = chars.length;
    const atlas = document.createElement('canvas');
    atlas.width = charCount * cellSize;
    atlas.height = cellSize;
    const ctx = atlas.getContext('2d');
    ctx.fillStyle = 'transparent';
    ctx.clearRect(0,0,atlas.width, atlas.height);
    ctx.fillStyle = 'white';
    ctx.font = cellSize + 'px monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    for(let i=0;i<charCount;i++){
      const x = i * cellSize + cellSize * 0.5;
      const y = cellSize * 0.5;
      ctx.fillText(chars[i], x, y);
    }

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  function wrapAsciiHoverText(root){
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while(walker.nextNode()){
      const node = walker.currentNode;
      const parent = node.parentElement;
      if(!node.nodeValue.trim().length) continue;
      if(!parent) continue;
      if(parent.closest('.hover-char')) continue;
      if(parent.closest('.menu-button')) continue;
      if(parent.closest('pre')) continue;
      if(parent.closest('script') || parent.closest('style')) continue;
      nodes.push(node);
    }
    for(const node of nodes){
      const parent = node.parentElement;
      const text = node.nodeValue.replace(/\r|\n/g, '');
      if (!text.length) continue;
      const frag = document.createDocumentFragment();
      for(const char of text){
        const span = document.createElement('span');
        span.className = 'hover-char';
        if(char === ' ') {
          span.classList.add('whitespace');
          span.textContent = ' ';
        } else {
          span.textContent = char;
        }
        frag.appendChild(span);
      }
      parent.replaceChild(frag, node);
    }
  }

  function start(){
    document.querySelectorAll('.ascii-hide').forEach(wrapAsciiHoverText);
    window.wrapAsciiHoverText = wrapAsciiHoverText;

    const canvas = createCanvas();
    const gl = canvas.getContext('webgl');
    if(!gl){
      console.warn('WebGL not available, falling back to 2D ascii background');
      return;
    }

    const vertexSource = `
      attribute vec2 aPosition;
      varying vec2 vUv;
      void main(){
        vUv = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision mediump float;
      varying vec2 vUv;
      uniform vec2 uResolution;
      uniform float uTime;
      uniform float uCellSize;
      uniform float uCharCount;
      uniform sampler2D uCharAtlas;

      float fade(float t){ return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float grad(vec2 p, float h){
        float angle = h * 6.28318530718;
        vec2 g = vec2(cos(angle), sin(angle));
        return dot(g, p);
      }
      float perlin(vec2 P){
        vec2 i = floor(P);
        vec2 f = fract(P);
        float a = hash(i + vec2(0.0, 0.0));
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        float u = fade(f.x);
        float v = fade(f.y);
        float x1 = mix(grad(f, a), grad(f - vec2(1.0, 0.0), b), u);
        float x2 = mix(grad(f - vec2(0.0, 1.0), c), grad(f - vec2(1.0, 1.0), d), u);
        return mix(x1, x2, v) * 0.5 + 0.5;
      }

      void main(){
        float step = uCellSize;
        vec2 grid = floor(vUv * uResolution / step);
        vec2 cellUv = fract(vUv * uResolution / step);
        float noise = perlin(grid * 0.08 + vec2(uTime * 0.0008));
        float idx = floor(noise * (uCharCount - 1.0) + 0.5);
        vec2 atlasUv = vec2((idx + cellUv.x) / uCharCount, 1.0 - cellUv.y);
        float charAlpha = texture2D(uCharAtlas, atlasUv).r;
        gl_FragColor = vec4(vec3(charAlpha), charAlpha);
      }
    `;

    const program = createProgram(gl, vertexSource, fragmentSource);
    const positionLocation = gl.getAttribLocation(program, 'aPosition');
    const resolutionLocation = gl.getUniformLocation(program, 'uResolution');
    const timeLocation = gl.getUniformLocation(program, 'uTime');
    const cellSizeLocation = gl.getUniformLocation(program, 'uCellSize');
    const charCountLocation = gl.getUniformLocation(program, 'uCharCount');

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      -1, 1,
      1, -1,
      1, 1
    ]), gl.STATIC_DRAW);

    const atlasTexture = createCharAtlasTexture(gl, CHARS, cellSizeDefault * 2);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlasTexture);

    let dpr = Math.max(1, window.devicePixelRatio || 1);
    function resize(){
      dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resize);
    resize();

    let time = 0;
    function frame(){
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);

      gl.enableVertexAttribArray(positionLocation);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, time);
      gl.uniform1f(cellSizeLocation, cellSizeDefault * dpr);
      gl.uniform1f(charCountLocation, CHARS.length);
      gl.uniform1i(gl.getUniformLocation(program, 'uCharAtlas'), 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      time += 1;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

})();
