(function(){
  const catBox = document.getElementById('catBox');
  let returnTimer = null;
  let isScared = false;
  let isInsideCatArea = false;

  const scareCat = () => {
    if (isScared) return;

    isScared = true;
    catBox.classList.add('scared');
    clearTimeout(returnTimer);

    const randomWaitTime = Math.random() * (6000 - 2000) + 2000;

    returnTimer = setTimeout(() => {
      catBox.classList.remove('scared');
      setTimeout(() => {
        isScared = false;
      }, 500);
    }, randomWaitTime);
  };

  window.addEventListener('mousemove', (event) => {
    const rect = catBox.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (inside && !isInsideCatArea) {
      isInsideCatArea = true;
      scareCat();
    } else if (!inside) {
      isInsideCatArea = false;
    }
  });
})();
