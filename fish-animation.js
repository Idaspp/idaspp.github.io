(function(){
  const siteRoot = document.querySelector('.site-root');
  const frames = [
    ' ¸.;;__\n<_*((.=;,\n   ``    ™',
    ' ¸,;;_\n<_*((.={{\n  `""',
    ' ¸,;;_  _\n<_*((..=†"\n `"``'
  ];
  // Type black characters here to place them behind the matching foreground frame.
  const blackFrames = [
    ' ¸▄██__\n████████▄\n   ▀▀    ▀',
    '  ▄██_\n█████████\n  ▀▀▀▀',
    '  ▄██_  _\n█████████▀\n ▀▀▀▀'
  ];
  const verticalOffsets = [8, -6, 13];
  const renderedCells = new WeakMap();
  const fish = document.createElement('pre');
  fish.id = 'ascii-fish';
  fish.setAttribute('aria-hidden', 'true');
  const blackFish = document.createElement('pre');
  blackFish.id = 'ascii-fish-black';
  blackFish.setAttribute('aria-hidden', 'true');
  function renderFrame(layer, frame, color, frameSet){
    const lines = frame.split('\n');
    let rows = renderedCells.get(layer);
    if (!rows) {
      const maxWidths = lines.map((_, lineIndex) => Math.max(
        ...frameSet.map((candidate) => candidate.split('\n')[lineIndex]?.length || 0)
      ));
      rows = maxWidths.map((width, lineIndex) => {
        const cells = [];
        for (let column = 0; column < width; column += 1) {
          const cell = document.createElement('span');
          cell.style.display = 'inline-block';
          cell.style.minWidth = '1ch';
          cells.push(cell);
          layer.appendChild(cell);
        }
        if (lineIndex < maxWidths.length - 1) layer.appendChild(document.createElement('br'));
        return cells;
      });
      renderedCells.set(layer, rows);
    }

    lines.forEach((line, lineIndex) => {
      rows[lineIndex].forEach((cell, column) => {
        const character = line[column] || ' ';
        if (cell.textContent !== character) cell.textContent = character;
        cell.style.color = character === ' ' ? '' : color;
      });
    });
  }
  renderFrame(blackFish, blackFrames[0], '#000', blackFrames);
  renderFrame(fish, frames[0], 'hsl(var(--foreground))', frames);
  fish.style.cssText = `
    position: absolute;
    left: 0;
    top: 0;
    z-index: 45;
    margin: 0;
    color: hsl(var(--foreground));
    font-family: monospace;
    font-size: 0.75rem;
    line-height: 0.82;
    white-space: pre;
    pointer-events: none;
    user-select: none;
    text-shadow: 0 0 2px hsl(var(--foreground));
    transform: none;
    transition: none;
  `;
  blackFish.style.cssText = fish.style.cssText + `
    z-index: 44;
    color: #000;
    text-shadow: none;
  `;
  const fishTrack = document.createElement('div');
  fishTrack.id = 'ascii-fish-track';
  fishTrack.style.cssText = `
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 1px;
    overflow: hidden;
    pointer-events: none;
  `;
  fishTrack.appendChild(blackFish);
  fishTrack.appendChild(fish);
  document.body.appendChild(fishTrack);

  let frameIndex = 0;
  let frameDirection = 1;
  let startTime = null;
  let lastFrameTime = 0;
  const travelDuration = 36000;
  const waveCycles = 1;
  const waveAmplitude = 4;
  const bobAmplitude = 4;
  const baseY = 18;
  const minY = 10;
  const maxY = 28;

  function updateFish(timestamp){
    const fishWidth = fish.getBoundingClientRect().width;
    const pageWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const pageHeight = siteRoot
      ? siteRoot.getBoundingClientRect().bottom + window.scrollY
      : Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const fishHeight = fish.getBoundingClientRect().height;
    if(startTime === null) startTime = timestamp;

    const elapsed = timestamp - startTime;
    const legElapsed = elapsed % travelDuration;
    const leg = Math.floor(elapsed / travelDuration);
    const legProgress = legElapsed / travelDuration;
    const direction = leg % 2 === 0 ? -1 : 1;
    const progress = direction === -1 ? 1 - legProgress : legProgress;
    const wave = progress * Math.PI * 2 * waveCycles;
    const travelWidth = pageWidth + fishWidth + 32;
    const x = -fishWidth - 16 + progress * travelWidth;
    const waveY = Math.sin(wave) * waveAmplitude;
    const bobY = Math.sin(elapsed * 0.0032 + progress * 1.7) * bobAmplitude;
    const y = Math.max(minY, Math.min(maxY, baseY + bobY));
    const pathSlope = direction * Math.cos(wave) * waveAmplitude * waveCycles * Math.PI * 2 / travelWidth;
    const yRange = maxY - minY + 12;
    const swimAngle = Math.atan(pathSlope) * 2.4;

    fish.style.left = `${x}px`;
    blackFish.style.left = `${x}px`;
    fishTrack.style.top = `${Math.max(0, pageHeight - fishHeight - yRange - 24)}px`;
    fishTrack.style.height = `${yRange * 2 + 24}px`;
    const transform = `translateY(${y}px) rotate(${swimAngle}rad) scaleX(${-direction})`;
    fish.style.transform = transform;
    blackFish.style.transform = transform;

    if(elapsed - lastFrameTime >= 400){
      frameIndex += frameDirection;
      if(frameIndex === frames.length - 1 || frameIndex === 0) frameDirection *= -1;
      renderFrame(blackFish, blackFrames[frameIndex], '#000', blackFrames);
      renderFrame(fish, frames[frameIndex], 'hsl(var(--foreground))', frames);
      lastFrameTime = elapsed;
    }

    requestAnimationFrame(updateFish);
  }

  requestAnimationFrame(updateFish);
})();
