// Click-to-load games for the portfolio timeline (fullscreen is opt-in, canvas scaled to fit).
// Scripts inside <template> pages don't run, so this uses one document-level click listener.
(() => {
  let active = null; // { frame, iframe, play, bar, exit, wasFrozen, fitTimer }

  // The game is served from the same site, so we can reach into the iframe and scale its canvas
  // up to fill the available space (keeping the aspect ratio). Mouse input still maps correctly.
  function fitCanvas(iframe) {
    let doc;
    try { doc = iframe.contentDocument; } catch (_) { return; } // blocked if not same-origin / opened from file://
    if (!doc || !doc.body) return;
    if (!doc.getElementById('tl-fit')) {
      const style = doc.createElement('style');
      style.id = 'tl-fit';
      // Strips the LÖVE Web Builder page chrome (blue box, margins, footer) so only the game shows.
      style.textContent =
        'html,body{margin:0!important;width:100%;height:100%;background:#000!important;overflow:hidden!important}' +
        '#wrapper{margin:0!important;padding:0!important;border:0!important;min-height:0!important}' +
        '#main{margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:#000!important}' +
        '#footer{display:none!important}';
      (doc.head || doc.documentElement).append(style);
    }
    const canvas = doc.getElementById('canvas') || doc.querySelector('canvas');
    if (!canvas || !canvas.width || !canvas.height) return;
    const scale = Math.min(iframe.clientWidth / canvas.width, iframe.clientHeight / canvas.height);
    if (!(scale > 0)) return;
    const set = (prop, value) => canvas.style.setProperty(prop, value, 'important');
    set('position', 'fixed');
    set('left', '50%');
    set('top', '50%');
    set('transform', 'translate(-50%, -50%)');
    set('margin', '0');
    set('max-width', 'none');
    set('max-height', 'none');
    set('width', Math.floor(canvas.width * scale) + 'px');
    set('height', Math.floor(canvas.height * scale) + 'px');
  }

  function enterFullscreen(frame) {
    const request = frame.requestFullscreen || frame.webkitRequestFullscreen;
    if (request) Promise.resolve(request.call(frame)).catch(() => {}); // unsupported (e.g. iPhone): game just plays in its box
  }

  function exitFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  function focusGame() {
    if (!active) return;
    active.iframe.focus();
    try {
      const { contentDocument: doc, contentWindow } = active.iframe;
      contentWindow.focus();
      const canvas = doc && (doc.getElementById('canvas') || doc.querySelector('canvas'));
      if (canvas) {
        if (!canvas.hasAttribute('tabindex')) canvas.setAttribute('tabindex', '0');
        canvas.focus();
      }
    } catch (_) { /* focus stays on the iframe if its document is cross-origin */ }
  }

  function stopGame() {
    if (!active) return;
    const { iframe, play, bar, exit, pad, wasFrozen, fitTimer } = active;
    clearInterval(fitTimer);
    releasePadKeys();
    exitFullscreen();
    iframe.remove();               // unloads the game completely (stops audio and its loop)
    bar.remove();
    exit.remove();
    pad.remove();
    play.hidden = false;
    active.frame.classList.remove('is-playing');
    window.isBgFrozen = wasFrozen; // give the ASCII background back
    active = null;
  }

  function makeButton(label, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    return button;
  }

  const padControls = [
    { label: '↑', ariaLabel: 'Up arrow', className: 'tl-pad-up', keys: [{ key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 }] },
    { label: '←', ariaLabel: 'Left arrow', className: 'tl-pad-left', keys: [{ key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 }] },
    { label: '↓', ariaLabel: 'Down arrow', className: 'tl-pad-down', keys: [{ key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 }] },
    { label: 'A', ariaLabel: 'Space or Enter action', className: 'tl-pad-action', keys: [
      { key: ' ', code: 'Space', keyCode: 32 },
      { key: 'Enter', code: 'Enter', keyCode: 13 },
    ] },
    { label: '→', ariaLabel: 'Right arrow', className: 'tl-pad-right', keys: [{ key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }] },
  ];
  const pressedPadKeys = new Map();

  function dispatchGameKey(keyInfo, type) {
    if (!active) return;
    try {
      const { contentDocument: doc, contentWindow: { KeyboardEvent } } = active.iframe;
      const target = doc && (doc.getElementById('canvas') || doc);
      if (!target || !KeyboardEvent) return;
      const event = new KeyboardEvent(type, {
        key: keyInfo.key,
        code: keyInfo.code,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'keyCode', { get: () => keyInfo.keyCode });
      Object.defineProperty(event, 'which', { get: () => keyInfo.keyCode });
      target.dispatchEvent(event);
    } catch (_) { /* controls are unavailable for a cross-origin game */ }
  }

  function releasePadKeys() {
    for (const keyInfo of pressedPadKeys.values()) dispatchGameKey(keyInfo, 'keyup');
    pressedPadKeys.clear();
  }

  function makePad() {
    const pad = document.createElement('div');
    pad.className = 'tl-pad';
    pad.setAttribute('role', 'group');
    pad.setAttribute('aria-label', 'Touch game controls');
    for (const control of padControls) {
      const button = makeButton(control.label, `tl-pad-button ${control.className}`);
      button.setAttribute('aria-label', control.ariaLabel);
      button.addEventListener('contextmenu', (event) => event.preventDefault());
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        control.keys.forEach((keyInfo) => {
          if (!pressedPadKeys.has(keyInfo.code)) {
            pressedPadKeys.set(keyInfo.code, keyInfo);
            dispatchGameKey(keyInfo, 'keydown');
          }
        });
      });
      const release = (event) => {
        if (event && event.pointerId !== undefined && button.hasPointerCapture(event.pointerId)) {
          button.releasePointerCapture(event.pointerId);
        }
        control.keys.forEach((keyInfo) => {
          if (pressedPadKeys.has(keyInfo.code)) {
            dispatchGameKey(keyInfo, 'keyup');
            pressedPadKeys.delete(keyInfo.code);
          }
        });
      };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
      pad.append(button);
    }
    return pad;
  }

  function startGame(play) {
    const frame = play.closest('.tl-game');
    if (!frame || !frame.dataset.game) return;
    stopGame(); // only one game at a time

    const iframe = document.createElement('iframe');
    iframe.src = frame.dataset.game;
    iframe.title = frame.dataset.title || 'Game';
    iframe.allow = 'autoplay; fullscreen; gamepad';
    iframe.setAttribute('allowfullscreen', '');
    iframe.addEventListener('load', () => {
      fitCanvas(iframe);
      iframe.focus(); // keys go to the game
      try {
        iframe.contentDocument.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') event.preventDefault();
        }, { capture: true });
      } catch (_) { /* parent-document handling below still prevents page scrolling */ }
      // LÖVE Web Builder games show a "Click here to launch the game" panel; click it for the visitor.
      try {
        const canvas = iframe.contentDocument.getElementById('canvas');
        if (canvas && canvas.onclick) canvas.click();
      } catch (_) { /* not same-origin: the visitor clicks the panel themselves */ }
    });

    const bar = document.createElement('div');
    bar.className = 'tl-bar';
    bar.append(makeButton('□ Fullscreen', 'tl-fs'), makeButton('X Stop Game', 'tl-stop'));

    // Lives inside the frame so it is still visible while the frame is fullscreen (CSS shows it only then).
    const exit = makeButton('X Exit Fullscreen', 'tl-exit');
    const pad = makePad();

    play.hidden = true;
    frame.classList.add('is-playing');
    frame.append(iframe, exit, pad);
    frame.after(bar);

    // Pause the animated ASCII background while a game runs (ascii-bg.js honours this flag).
    active = { frame, iframe, play, bar, exit, pad, wasFrozen: Boolean(window.isBgFrozen), fitTimer: setInterval(() => fitCanvas(iframe), 250) };
    window.isBgFrozen = true;

  }

  document.addEventListener('click', (event) => {
    const play = event.target.closest('.tl-play');
    if (play) { startGame(play); return; }
    if (event.target.closest('.tl-stop')) { stopGame(); return; }
    if (event.target.closest('.tl-exit')) { exitFullscreen(); return; }
    if (event.target.closest('.tl-fs') && active) {
      if (document.fullscreenElement) exitFullscreen();
      else enterFullscreen(active.frame);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (active && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) event.preventDefault();
  }, { capture: true });

  // Restore the game canvas keyboard focus when the tab/window returns from the background.
  let pageWasUnfocused = false;
  window.addEventListener('blur', () => { pageWasUnfocused = true; });
  window.addEventListener('focus', () => {
    if (pageWasUnfocused) focusGame();
    pageWasUnfocused = false;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pageWasUnfocused = true;
    else if (pageWasUnfocused) {
      focusGame();
      pageWasUnfocused = false;
    }
  });

  // Fullscreen transitions can also move focus away from the game.
  document.addEventListener('fullscreenchange', focusGame);

  // Leaving the page throws the game away; make sure the background is released.
  window.addEventListener('hashchange', stopGame);
})();
