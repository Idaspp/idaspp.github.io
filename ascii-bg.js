(()=>{
  const CHARS = " .:-=+*#%@"; // depth characters from light to dark
  const cellSizeDefault = 12;

  // Perlin noise implementation (2D)
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
          span.textContent = '\u00A0';
        } else {
          span.textContent = char;
        }
        frag.appendChild(span);
      }
      parent.replaceChild(frag, node);
    }
  }

  function perlin2(x,y){
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const topRight = p[p[X+1]+Y+1];
    const topLeft  = p[p[X]+Y+1];
    const bottomRight = p[p[X+1]+Y];
    const bottomLeft  = p[p[X]+Y];

    const u = fade(xf);
    const v = fade(yf);

    const x1 = lerp(u, grad(bottomLeft, xf, yf), grad(bottomRight, xf-1, yf));
    const x2 = lerp(u, grad(topLeft, xf, yf-1), grad(topRight, xf-1, yf-1));
    return lerp(v, x1, x2) * 0.5; // roughly -1..1
  }

  function createCanvas(){
    const root = document.createElement('div');
    root.id = 'ascii-bg-root';
    const canvas = document.createElement('canvas');
    canvas.id = 'ascii-bg-canvas';
    root.appendChild(canvas);
    document.body.appendChild(root);
    return canvas;
  }

  function start(){
    document.querySelectorAll('.ascii-hide').forEach(wrapAsciiHoverText);
    window.wrapAsciiHoverText = wrapAsciiHoverText;
    const canvas = createCanvas();
    const ctx = canvas.getContext('2d');
    let dpr = Math.max(1, window.devicePixelRatio || 1);

    function resize(){
      dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    }
    window.addEventListener('resize', resize);
    resize();

    let time = 0;
    const cellSize = cellSizeDefault * (dpr>1?1:1);
    function frame(){
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle = 'rgba(220,220,220,0.6)';
      ctx.textBaseline = 'top';
      ctx.font = (cellSize * dpr) + 'px monospace';

      const cols = Math.floor(W / (cellSize * dpr));
      const rows = Math.ceil(H / (cellSize * dpr));

      const scale = 0.08;
      for(let y=0;y<rows;y++){
        for(let x=0;x<cols;x++){
          const nx = x*scale + time*0.0008;
          const ny = y*scale + time*0.0008;
          const n = perlin2(nx, ny);
          const v = Math.max(0, Math.min(1, (n + 1) * 0.5));
          const idx = Math.floor(v * (CHARS.length - 1));
          const ch = CHARS[idx];
          ctx.fillText(ch, x * (cellSize * dpr), y * (cellSize * dpr));
        }
      }
      time += 16;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

})();
