(function(){
  const CHARS = ' .:-=+08#%@▓';
  const cols = 20;
  const rows = 20;
  const cellSize = 16;
  const outputStretch = 2;
  const FRAME_COUNT = 12;
  const CACHE_KEY = 'cd-animation-frames-v1';
  localStorage.removeItem(CACHE_KEY); // Clear cache for testing purposes
  // Off-canvas drawer wrapper
  const drawer = document.createElement('div');
  drawer.id = 'cd-drawer';
  drawer.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: -1000px;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 0;
    align-items: center;
    transition: left 0.5s ease-in-out;
  `;

  // Toggle arrow (visible as tab when drawer is closed)
  const toggleArrow = document.createElement('button');
  toggleArrow.id = 'cd-toggle-arrow';
  toggleArrow.textContent = '>\n>';
  toggleArrow.style.cssText = `
    -webkit-text-stroke: 7px black;
    paint-order: stroke fill;  
    position: fixed;
    bottom: calc(20px + 160px);
    left: 0px;
    z-index: 51;
    background: transparent;
    border: none;
    color: hsl(var(--foreground));
    font-family: var(--font-body);
    font-size: 2rem;
    line-height: 1;
    width: 40px;
    height: auto;
    padding: 0;
    margin: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: left 0.5s ease-in-out, transform 80ms steps(2, end);
    user-select: none;
    flex-shrink: 0;
    transform: translateY(50%);
  `;

  // ASCII CD content container (no background)
  const cdContent = document.createElement('div');
  cdContent.id = 'ascii-cd-drawer-content';
  cdContent.style.cssText = `
    flex-shrink: 0;
    pointer-events: auto;
  `;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const pre = document.createElement('pre');

  canvas.width = cols * cellSize;
  canvas.height = rows * cellSize;
  pre.id = 'ascii-cd-raster';
  pre.textContent = '';
  pre.style.cssText = `
    margin: 0;
    padding: 0;
    line-height: 1;
  `;
  cdContent.appendChild(pre);

  // Media player container (will be populated by MediaPlayer module)
  const mediaPlayerWrapper = document.createElement('div');
  mediaPlayerWrapper.id = 'media-player-wrapper';
  mediaPlayerWrapper.style.cssText = `
    width: 100%;
    margin-top: 0px;
    padding-top: 0px;
    padding-left: 10px;
    padding-right: 10px;
    box-sizing: border-box;
  `;

  // Assemble drawer (arrow is separate, fixed position)
  drawer.appendChild(cdContent);
  drawer.appendChild(mediaPlayerWrapper);
  document.body.appendChild(drawer);
  document.body.appendChild(toggleArrow);

  const image = new Image();
  let frames = [];
  let currentFrameIndex = 0;
  let isDrawerOpen = false;
  let animationFrameId = null;
  let isPlayingAudio = false;

  function mapChar(value){
    const idx = Math.floor((1 - value) * (CHARS.length - 1));
    return CHARS[idx];
  }

  function generateFrame(angle){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width * 0.5, canvas.height * 0.5);
    ctx.rotate(angle);
    const scale = Math.min(canvas.width, canvas.height) * 0.65 / Math.max(image.width, image.height);
    const dw = image.width * scale;
    const dh = image.height * scale;
    ctx.drawImage(image, -dw * 0.5, -dh * 0.5, dw, dh);
    ctx.restore();
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const cellW = cellSize;
    const cellH = cellSize;
    const alphaGrid = [];
    const charGrid = [];

    for(let y = 0; y < rows; y++){
      alphaGrid[y] = [];
      charGrid[y] = [];
      for(let x = 0; x < cols; x++){
        let brightness = 0;
        let alphaSum = 0;
        const startX = x * cellW;
        const startY = y * cellH;
        for(let sy = 0; sy < cellH; sy++){
          for(let sx = 0; sx < cellW; sx++){
            const px = startX + sx;
            const py = startY + sy;
            const index = (py * canvas.width + px) * 4;
            const r = imageData[index];
            const g = imageData[index + 1];
            const b = imageData[index + 2];
            const a = imageData[index + 3] / 255;
            brightness += ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) * a;
            alphaSum += a;
          }
        }
        const pixels = cellW * cellH;
        const alphaAvg = alphaSum / pixels;
        alphaGrid[y][x] = alphaAvg;
        if(alphaAvg == 0){
          charGrid[y][x] = ' ';
        } else {
          charGrid[y][x] = mapChar(brightness / Math.max(alphaSum, 1));
        }
      }
    }

    const externalTransparent = [];
    for(let y = 0; y < rows; y++){
      externalTransparent[y] = [];
      for(let x = 0; x < cols; x++){
        externalTransparent[y][x] = false;
      }
    }

    const stack = [];
    function pushTransparent(x, y){
      if(x < 0 || y < 0 || x >= cols || y >= rows) return;
      if(externalTransparent[y][x]) return;
      if(alphaGrid[y][x] >= 0.08) return;
      externalTransparent[y][x] = true;
      stack.push([x, y]);
    }

    for(let x = 0; x < cols; x++){
      pushTransparent(x, 0);
      pushTransparent(x, rows - 1);
    }
    for(let y = 0; y < rows; y++){
      pushTransparent(0, y);
      pushTransparent(cols - 1, y);
    }

    while(stack.length){
      const [cx, cy] = stack.pop();
      pushTransparent(cx - 1, cy);
      pushTransparent(cx + 1, cy);
      pushTransparent(cx, cy - 1);
      pushTransparent(cx, cy + 1);
    }

    function hasVisibleNeighbor(px, py){
      for(let oy = -1; oy <= 1; oy++){
        for(let ox = -1; ox <= 1; ox++){
          if(ox === 0 && oy === 0) continue;
          const nx = px + ox;
          const ny = py + oy;
          if(nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          if(alphaGrid[ny][nx] >= 0.08) return true;
        }
      }
      return false;
    }

    let ascii = '';
    for(let y = 0; y < rows; y++){
      for(let x = 0; x < cols; x++){
        const isExternal = externalTransparent[y][x];
        let char = charGrid[y][x];
        if(char === ' ' && !isExternal){
          const cell = `<span class="ascii-cd-cell">&nbsp;</span>`.repeat(outputStretch);
          ascii += cell;
          continue;
        }
        if(char === ' ' && isExternal && hasVisibleNeighbor(x, y)){
          char = '#';
        }
        const cell = char === ' '
          ? ' '.repeat(outputStretch)
          : `<span class="ascii-cd-cell">${char}</span>`.repeat(outputStretch);
        ascii += cell;
      }
      ascii += '\n';
    }
    return ascii;
  }

  function generateAllFrames(){
    frames = [];
    for(let i = 0; i < FRAME_COUNT; i++){
      const angle = (i / FRAME_COUNT) * Math.PI * 2;
      frames.push(generateFrame(angle));
    }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(frames));
    } catch(e) {
      // localStorage full or disabled, use in-memory only
    }
  }

  function displayFrame(){
    if(frames.length === 0) return;
    pre.innerHTML = frames[currentFrameIndex];
    currentFrameIndex = (currentFrameIndex + 1) % frames.length;
    updatePositions(); // Update width on every frame to ensure it's accurate
  }

  function startAnimation(){
    if(animationFrameId) return;
    if(!isDrawerOpen || !isPlayingAudio) return; // Only animate if drawer is open AND audio is playing
    displayFrame();
    animationFrameId = setInterval(displayFrame, 200);
  }

  function stopAnimation(){
    if(animationFrameId) {
      clearInterval(animationFrameId);
      animationFrameId = null;
    }
  }

  function updateAnimationState(){
    if(isDrawerOpen && isPlayingAudio){
      startAnimation();
    } else {
      stopAnimation();
    }
  }

  function loadCD(){
    if(!image.complete) {
      setTimeout(loadCD, 200);
      return;
    }
    // Try to load cached frames
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if(cached){
        frames = JSON.parse(cached);
      }
    } catch(e) {
      // Ignore errors
    }

    // Generate frames if not cached
    if(frames.length === 0){
      generateAllFrames();
    }

    // Set up media player callback if available
    if(window.MediaPlayer){
      window.MediaPlayer.onPlayStateChange((isPlaying) => {
        isPlayingAudio = isPlaying;
        updateAnimationState();
      });
      // Mount the media player to the drawer
      window.MediaPlayer.mount(mediaPlayerWrapper);
    }

    updateAnimationState();
  }

  toggleArrow.addEventListener('click', () => {
    updatePositions(); // Ensure width is fresh
    isDrawerOpen = !isDrawerOpen;
    const drawerLeft = isDrawerOpen ? 0 : -cdWidth;
    drawer.style.left = drawerLeft + 'px';
    
    // Update arrow position after drawer has positioned
    requestAnimationFrame(() => {
      updatePositions(); // Re-measure in case width changed
      const arrowLeft = Math.max(drawerLeft + cdWidth, 0);
      toggleArrow.style.left = arrowLeft + 'px';
    });
    
    toggleArrow.textContent = isDrawerOpen ? '«' : '»';
    
    if(isDrawerOpen) {
      loadCD();
    }
    updateAnimationState();
  });

  toggleArrow.addEventListener('mousedown', () => {
    toggleArrow.style.transform = 'translateX(20%) translateY(50%)';
  });

  toggleArrow.addEventListener('mouseup', () => {
    toggleArrow.style.transform = 'translateY(50%)';
  });

  toggleArrow.addEventListener('mouseleave', () => {
    toggleArrow.style.transform = 'translateY(50%)';
  });

  // Initialize arrow position (starts at drawer left + CD width)
  let cdWidth = cols * cellSize * outputStretch; 

  function updatePositions() {
    const measuredWidth = pre.offsetWidth;
    if(measuredWidth > 0) {
      cdWidth = measuredWidth;
    }
    drawer.style.width = cdWidth + 'px';
  }

  const updatePositionsOnce = () => {
    if(pre.offsetWidth > 0) {
      updatePositions();
      requestAnimationFrame(() => {
        updatePositions();
        requestAnimationFrame(updatePositions);
      });
    } else {
      requestAnimationFrame(updatePositionsOnce);
    }
  };
  
  // Set initial hidden positions
  updatePositionsOnce();
  drawer.style.left = -cdWidth + 'px';
  requestAnimationFrame(() => {
    toggleArrow.style.left = '0px';
  });
  toggleArrow.textContent = '»';
  
  // SAFE LOAD PATTERN: Bind the load event BEFORE setting the source path
  image.onload = function() {
    // 1. Generate frames immediately now that the image is officially in memory
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        frames = JSON.parse(cached);
        console.log('Found cd cached frames')
      }
    } catch(e) {}

    if (frames.length === 0) {
      console.log('Did not find cd cached frames, building...')
      generateAllFrames();
    }

    // 2. Lock down visual metrics
    updatePositions();
    currentFrameIndex = 0;
    displayFrame(); // Display frame 0 as static baseline

    // 3. Attach media hooks safely
    if (window.MediaPlayer) {
      window.MediaPlayer.onPlayStateChange((isPlaying) => {
        isPlayingAudio = isPlaying;
        updateAnimationState();
      });
      window.MediaPlayer.mount(mediaPlayerWrapper);
    }
    updateAnimationState();
  };

  // Trigger browser download safely
  image.src = './images/cd.svg';
})();