export function watchRewarded(onDone) {
  const modal = document.getElementById('ad-modal');
  const cd = document.getElementById('ad-countdown');
  modal.classList.remove('hidden');
  modal.classList.add('active');
  let n = 5;
  cd.textContent = String(n);
  const t = setInterval(() => {
    n--;
    if (n <= 0) {
      clearInterval(t);
      modal.classList.add('hidden');
      modal.classList.remove('active');
      onDone(true);
    } else {
      cd.textContent = String(n);
    }
  }, 1000);
}
