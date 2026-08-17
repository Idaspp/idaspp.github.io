const canvas = document.getElementById('ascii-canvas');
if (!canvas) {
    console.warn('ascii-canvas element not found; skipping reveal effect');
} else {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.warn('2D canvas context not available; skipping reveal effect');
    } else {
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        const burnDensitySequence = ['▓', '@', '%', '#', '0', '8', '+', '=', '-', ':', '.', ' '];
        const fontSize = 16; 

        ctx.font = `bold ${fontSize}px monospace`;
        const charWidth = Math.ceil(ctx.measureText("M").width);
        const charHeight = fontSize;

        // texture atlas prerendering

        const cacheCanvas = document.createElement('canvas');
        const cacheCtx = cacheCanvas.getContext('2d');
        const numChars = burnDensitySequence.length;
        const numSteps = 11; // 0 to 10 color steps

        cacheCanvas.width = numChars * charWidth;
        cacheCanvas.height = numSteps * charHeight;
        cacheCtx.font = `bold ${fontSize}px monospace`;
        cacheCtx.textBaseline = "top";

        // Pre render all characters at all color phases onto a hidden canvas
        for (let step = 0; step < numSteps; step++) {
            const life = step / 10;
            const alpha = (life < 0.3) ? (life / 0.3) : 1.0;
            cacheCtx.fillStyle = `rgba(255, ${Math.floor(life * 230)}, ${Math.floor(Math.max(0, life - 0.5) * 140)}, ${alpha})`;
            
            for (let c = 0; c < numChars; c++) {
                cacheCtx.fillText(
                    burnDensitySequence[c], 
                    c * charWidth, 
                    step * charHeight
                );
            }
        }

        let progress = 0;
        let phase = 'loading'; 
        let burnLineY = -100;
        let loadStartTime = Date.now();
        let pageLoadTime = null;
        const MIN_LOAD_DURATION = 2500; 

        const particles = [];
        const loaderParticles = []; 
        let waveTime = 0;

        window.addEventListener('load', () => {
            pageLoadTime = Date.now();
        });

        function handleResize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', handleResize);

        function convertLoaderToParticles() {
            const barLength = 25;
            const filledLength = Math.round((progress / 100) * barLength);
            
            let line1 = "Loading...";
            let line2 = "[";
            for (let i = 0; i < barLength; i++) {
                line2 += (i < filledLength) ? "#" : "-";
            }
            line2 += "] 100%";

            ctx.font = `bold ${fontSize}px monospace`;
            const textX1 = (width - ctx.measureText(line1).width) / 2;
            const textX2 = (width - ctx.measureText(line2).width) / 2;
            const textY1 = (height / 2) - charHeight;
            const textY2 = (height / 2) + 4;

            for (let i = 0; i < line1.length; i++) {
                loaderParticles.push({
                    x: textX1 + (i * charWidth),
                    y: textY1,
                    char: line1[i],
                    burning: false,
                    life: 1.0,
                    decay: 0.01 + Math.random() * 0.015,
                    vx: (Math.random() - 0.5) * 1.0,
                    vy: -(Math.random() * 1.5 + 0.4)
                });
            }

            for (let i = 0; i < line2.length; i++) {
                loaderParticles.push({
                    x: textX2 + (i * charWidth),
                    y: textY2,
                    char: line2[i],
                    burning: false,
                    life: 1.0,
                    decay: 0.01 + Math.random() * 0.015,
                    vx: (Math.random() - 0.5) * 1.0,
                    vy: -(Math.random() * 1.5 + 0.4)
                });
            }
        }

        function updateLoader() {
            if (phase !== 'loading') return;

            const elapsedTime = Date.now() - loadStartTime;
            const isPageLoaded = pageLoadTime !== null;
            
            const progressTime = Math.min(elapsedTime, 2500);
            progress = (progressTime / 2500) * 99;
            
            if (isPageLoaded && elapsedTime >= MIN_LOAD_DURATION) {
                function finish_loading() {
                    progress = 100;
                    phase = 'burning';
                    convertLoaderToParticles();
                }

                setTimeout(finish_loading, 500);
                return;
            }
            
            if (isPageLoaded && progress < 100) {
                const remainingTime = MIN_LOAD_DURATION - elapsedTime;
                progress = elapsedTime/MIN_LOAD_DURATION; 
                progress = Math.max(progress, Math.min(elapsedTime / 2500 * 100, 100));
            }
            
            setTimeout(updateLoader, 30);
        }

        function getWaveHeightAt(x, baseLineY) {
            let layer1 = Math.sin(x * 0.005 + waveTime * 0.05) * 60;
            let layer2 = Math.cos(x * 0.015 - waveTime * 0.03) * 30;
            let layer3 = Math.sin(x * 0.03 + waveTime * 0.08) * 15;
            return baseLineY + layer1 + layer2 + layer3;
        }

        function spawnFireEmberRow() {
            const stepX = charWidth * 2.5;

            for (let x = 0; x < width; x += stepX) {
                if (Math.random() > 0.4) continue;
                let randomX = x + (Math.random() * stepX);
                if (randomX > width) randomX = width;
                let targetY = getWaveHeightAt(randomX, burnLineY);

                particles.push({
                    x: randomX,
                    y: targetY,
                    vx: (Math.random() - 0.5) * 1.0,
                    vy: -(Math.random() * 1.5 + 0.4), 
                    life: 1.0, 
                    decay: 0.01 + Math.random() * 0.01 
                });
            }
        }
        function animate() {
            ctx.fillStyle = '#000000';
            if (phase === 'loading') {
                ctx.fillRect(0, 0, width, height);
                ctx.font = `bold ${fontSize}px monospace`;
                ctx.textBaseline = "top";

                const barLength = 25;
                const filledLength = Math.round((progress / 100) * barLength);
                let line1 = "Loading...";
                let line2 = "[";
                for (let i = 0; i < barLength; i++) {
                    line2 += (i < filledLength) ? "#" : "-";
                }
                line2 += "] " + Math.floor(progress) + "%";

                ctx.fillStyle = '#ffffff';
                ctx.fillText(line1, ((width - ctx.measureText(line1).width) / 2) | 0, ((height / 2) - charHeight) | 0);
                ctx.fillText(line2, ((width - ctx.measureText(line2).width) / 2) | 0, ((height / 2) + 4) | 0);
                
                requestAnimationFrame(animate);
                return;
            }

            // Draw black canvas 
            ctx.clearRect(0, 0, width, height);

            if (phase === 'burning') {
                waveTime += 1.0; 
                burnLineY += 4.5; 

                // moving black mask
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.moveTo(0, height);

                // Map across the screen to create the waving edge
                for (let x = 0; x <= width; x += 30) {
                    const waveY = getWaveHeightAt(x, burnLineY);
                    ctx.lineTo(x, Math.max(0, waveY) | 0);
                }

                ctx.lineTo(width, height); // Connect to the bottom right corner
                ctx.closePath();
                ctx.fill(); // Fills only the unburned area from the wave down to the floor

                if (burnLineY < height + 150) {
                    spawnFireEmberRow();
                }
            }
            // batch processing embers with atlas
            for (let i = particles.length - 1; i >= 0; i--) {
                let p = particles[i];
                p.life -= p.decay;
                
                if (p.life <= 0) {
                    particles[i] = particles[particles.length - 1];
                    particles.pop();
                    continue;
                }
                
                p.x += p.vx; 
                p.y += p.vy;

                let charIdx = Math.floor((1.0 - p.life) * (numChars - 1));
                charIdx = Math.max(0, Math.min(numChars - 1, charIdx));
                
                let colorStep = Math.floor(p.life * 10);
                colorStep = Math.max(0, Math.min(10, colorStep));

                // Replace image blitting
                ctx.drawImage(
                    cacheCanvas,
                    charIdx * charWidth,      // Src x matching the character string
                    colorStep * charHeight,   // Src y matching color & opacity phase 
                    charWidth, charHeight,    // Src dimension bounds
                    p.x | 0, p.y | 0,         // Int screen target
                    charWidth, charHeight     // Target bounds
                );
            }

            // loading bar with atlas blitting
            let elementsRemaining = false;
            ctx.fillStyle = '#ffffff'; // Fallback for unburnt loader text elements
            ctx.font = `bold ${fontSize}px monospace`;
            ctx.textBaseline = "top";

            for (let i = 0; i < loaderParticles.length; i++) {
                let lp = loaderParticles[i];
                let activeWaveFrontY = getWaveHeightAt(lp.x, burnLineY);
                
                if (!lp.burning && lp.y <= activeWaveFrontY) {
                    lp.burning = true;
                }

                if (lp.burning) {
                    lp.life -= lp.decay;
                    if (lp.life <= 0) continue; 

                    elementsRemaining = true;
                    lp.x += lp.vx; 
                    lp.y += lp.vy; 

                    let charIdx = Math.floor((1.0 - lp.life) * (numChars - 1));
                    charIdx = Math.max(0, Math.min(numChars - 1, charIdx));
                    let colorStep = Math.floor(lp.life * 10);
                    colorStep = Math.max(0, Math.min(10, colorStep));

                    ctx.drawImage(
                        cacheCanvas,
                        charIdx * charWidth, colorStep * charHeight,
                        charWidth, charHeight,
                        lp.x | 0, lp.y | 0,
                        charWidth, charHeight
                    );
                } else {
                    elementsRemaining = true;
                    ctx.fillText(lp.char, lp.x | 0, lp.y | 0);
                }
            }

            if (phase === 'burning' && burnLineY > height + 200 && particles.length === 0 && !elementsRemaining) {
                phase = 'complete';
                canvas.remove(); 

                window.removeEventListener('resize', handleResize); 

                particles.length = 0;
                loaderParticles.length = 0;
                
                return; 
            }
            requestAnimationFrame(animate);
        }
        
        ctx.fillRect(0, 0, width, height);
        updateLoader();
        animate();
    }
}
