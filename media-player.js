(function(){
  // ⚙️ CONFIGURATION
  const USERNAME = 'Idaspp';
  const REPO_NAME = 'Favourite_Songs';
  const BAR_TOTAL_STEPS = 12; // Number of characters across the bar track

  // Create player container
  const playerContainer = document.createElement('div');
  playerContainer.id = 'media-player';
  playerContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    pointer-events: auto;
    font-family: var(--font-body);
  `;

  const DividerBar = document.createElement('div');
  DividerBar.id = 'DividerBar';
  DividerBar.style.cssText = `
    font-size: 24px;
    margin-bottom: 0px;
    letter-spacing: 2px;
    font-family: var(--font-body);
    opacity: 0.6;
    color: hsl(var(--foreground));
  `;
  DividerBar.textContent = '─────────────';

  // Create controls row
  const controlsRow = document.createElement('div');
  controlsRow.className = 'controls-row';
  controlsRow.style.cssText = `
    display: flex;
    justify-content: center;
    gap: 25px;
    margin-bottom: 0px;
  `;

  // Create buttons
  const backBtn = document.createElement('button');
  backBtn.id = 'backBtn';
  backBtn.className = 'control-btn';
  backBtn.textContent = '◄';
  backBtn.title = 'Back 5s';
  backBtn.style.cssText = `
    background: none;
    border: none;
    color: hsl(var(--foreground));
    font-family: var(--font-body);
    font-size: 28px;
    padding: 0;
    cursor: pointer;
    transition: transform 100ms ease;
  `;

  const playPauseBtn = document.createElement('button');
  playPauseBtn.id = 'playPauseBtn';
  playPauseBtn.className = 'control-btn';
  playPauseBtn.textContent = '⏸';
  playPauseBtn.title = 'Play / Pause';
  playPauseBtn.style.cssText = `
    background: none;
    border: none;
    color: hsl(var(--foreground));
    font-family: var(--font-body);
    font-size: 28px;
    padding: 0;
    cursor: pointer;
    transition: transform 100ms ease;
  `;

  const forwardBtn = document.createElement('button');
  forwardBtn.id = 'forwardBtn';
  forwardBtn.className = 'control-btn';
  forwardBtn.textContent = '►';
  forwardBtn.title = 'Forward 5s';
  forwardBtn.style.cssText = `
    background: none;
    border: none;
    color: hsl(var(--foreground));
    font-family: var(--font-body);
    font-size: 28px;
    padding: 0;
    cursor: pointer;
    transition: transform 100ms ease;
  `;

  const nextBtn = document.createElement('button');
  nextBtn.id = 'nextBtn';
  nextBtn.className = 'control-btn';
  nextBtn.textContent = '⏭';
  nextBtn.title = 'Next Random Song';
  nextBtn.style.cssText = `
    background: none;
    border: none;
    color: hsl(var(--foreground));
    font-family: var(--font-body);
    font-size: 28px;
    padding: 0;
    cursor: pointer;
    transition: transform 100ms ease;
  `;

  controlsRow.appendChild(backBtn);
  controlsRow.appendChild(playPauseBtn);
  controlsRow.appendChild(forwardBtn);
  controlsRow.appendChild(nextBtn);

  // Create progress bar
  const progressBar = document.createElement('div');
  progressBar.id = 'progressBar';
  progressBar.style.cssText = `
    font-size: 24px;
    margin-bottom: 0px;
    letter-spacing: 2px;
    font-family: var(--font-body);
    color: hsl(var(--foreground));
  `;
  progressBar.textContent = '─────────────';

  // Create status display
  const statusDiv = document.createElement('div');
  statusDiv.id = 'status';
  statusDiv.style.cssText = `
    -webkit-text-stroke: 7px black;
    paint-order: stroke fill;  
    font-size: 20px;
    color: hsl(var(--foreground));
    word-wrap: break-word;
    overflow-wrap: break-word;
    max-width: 400px;
    margin: 0 auto;
    font-family: var(--font-body);
  `;
  statusDiv.textContent = 'No song loaded';

  // Create hidden audio element
  const audioPlayer = document.createElement('audio');
  audioPlayer.id = 'audioPlayer';
  audioPlayer.style.display = 'none';

  playerContainer.appendChild(DividerBar);
  playerContainer.appendChild(controlsRow);
  playerContainer.appendChild(progressBar);
  playerContainer.appendChild(statusDiv);
  playerContainer.appendChild(audioPlayer);

  // State variables
  let livePlaylist = [];
  let currentSong = "";
  let onPlayStateChangeCallback = null;

  function pickNextSong() {
    if (livePlaylist.length === 0) return "";

    const eligibleSongs = livePlaylist.filter(song => song !== currentSong);
    const candidatePool = eligibleSongs.length > 0 ? eligibleSongs : livePlaylist;
    const randomIndex = Math.floor(Math.random() * candidatePool.length);
    return candidatePool[randomIndex];
  }

  // Update progress bar display
  function updateASCIIProgressBar(percentage) {
    const dotPosition = Math.round(percentage * BAR_TOTAL_STEPS);
    
    let visualBar = "";
    for (let i = 0; i <= BAR_TOTAL_STEPS; i++) {
      if (i === dotPosition) {
        visualBar += "●";
      } else {
        visualBar += "─";
      }
    }
    progressBar.textContent = visualBar;
  }

  // Load and play random song
  async function loadAndPlayRandomSong() {
    statusDiv.textContent = "Loading...";
    nextBtn.disabled = true;
    updateASCIIProgressBar(0);

    try {
      const listUrl = `https://${USERNAME}.github.io/${REPO_NAME}/songs.txt`;
      const response = await fetch(listUrl);
      
      if (!response.ok) {
        throw new Error("songs.txt not found.");
      }

      const textData = await response.text();

      livePlaylist = textData.split('\n')
        .map(line => line.trim())
        .filter(line => line.toLowerCase().endsWith('.mp3'));

      if (livePlaylist.length === 0) {
        throw new Error("No MP3 files found.");
      }

      const nextSong = pickNextSong();
      currentSong = nextSong || livePlaylist[Math.floor(Math.random() * livePlaylist.length)];
      
      const streamUrl = `https://${USERNAME}.github.io/${REPO_NAME}/${encodeURIComponent(currentSong)}`;
      audioPlayer.src = streamUrl;
      audioPlayer.load();
      
      audioPlayer.play().then(() => {
        statusDiv.textContent = currentSong.replace(/_/g, ' ');
        playPauseBtn.textContent = "⏸";
        nextBtn.disabled = false;
        if (onPlayStateChangeCallback) onPlayStateChangeCallback(true);
      }).catch(e => {
        statusDiv.textContent = currentSong.replace(/_/g, ' ');
        playPauseBtn.textContent = "⏵";
        nextBtn.disabled = false;
        if (onPlayStateChangeCallback) onPlayStateChangeCallback(false);
      });

    } catch (error) {
      console.error(error);
      statusDiv.textContent = error.message;
      nextBtn.disabled = false;
      if (onPlayStateChangeCallback) onPlayStateChangeCallback(false);
    }
  }

  // Button event listeners
  nextBtn.addEventListener('click', loadAndPlayRandomSong);

  playPauseBtn.addEventListener('click', () => {
    if (!audioPlayer.src) {
      loadAndPlayRandomSong();
      return;
    }
    if (audioPlayer.paused) {
      audioPlayer.play();
      playPauseBtn.textContent = "⏸";
      if (currentSong) statusDiv.textContent = currentSong.replace(/_/g, ' ');
      if (onPlayStateChangeCallback) onPlayStateChangeCallback(true);
    } else {
      audioPlayer.pause();
      playPauseBtn.textContent = "⏵";
      if (currentSong) statusDiv.textContent = currentSong.replace(/_/g, ' ');
      if (onPlayStateChangeCallback) onPlayStateChangeCallback(false);
    }
  });

  backBtn.addEventListener('click', () => {
    if (!audioPlayer.src) return;
    audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 5);
  });

  forwardBtn.addEventListener('click', () => {
    if (!audioPlayer.src) return;
    audioPlayer.currentTime = Math.min(audioPlayer.duration || 9999, audioPlayer.currentTime + 5);
  });

  // Hover effects for buttons
  const buttons = [backBtn, playPauseBtn, forwardBtn, nextBtn];
  buttons.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(0.95)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
    });
  });

  // Time ticker monitor
  audioPlayer.addEventListener('timeupdate', () => {
    if (!audioPlayer.duration) return;
    const currentPercentage = audioPlayer.currentTime / audioPlayer.duration;
    updateASCIIProgressBar(currentPercentage);
  });

  // Autoloop on track end
  audioPlayer.addEventListener('ended', loadAndPlayRandomSong);

  // Public API
  window.MediaPlayer = {
    getContainer: () => playerContainer,
    getAudioElement: () => audioPlayer,
    isPlaying: () => !audioPlayer.paused,
    getCurrentTime: () => audioPlayer.currentTime,
    getDuration: () => audioPlayer.duration || 0,
    onPlayStateChange: (callback) => {
      onPlayStateChangeCallback = callback;
    },
    mount: (element) => {
      element.appendChild(playerContainer);
    }
  };

  console.log('MediaPlayer initialized');
})();
