const app = document.querySelector('#sanAndreasWindow');
const frame = document.querySelector('#sanAndreasFrame');
const status = document.querySelector('#sanAndreasStatus');
const runtime = new URL('../games/san-andreas/', import.meta.url);
let attempt = 0;

function shortcut(container, className, text) {
  if (!container) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.open = 'sanAndreas';
  const icon = '<svg aria-hidden="true"><use href="#i-games"/></svg>';
  button.innerHTML = className === 'desktop-icon'
    ? `<span class="desktop-icon-art app-art">${icon}<i class="shortcut-arrow">↗</i></span><span>${text}</span>`
    : className === 'start-game'
      ? `<span class="start-icon">${icon}</span><div><strong>San Andreas</strong><small>Solo exploration preview</small></div>`
      : `${icon}<span>${text}</span>`;
  button.addEventListener('click', () => window.ZeroHDesktop.openApp('sanAndreas'));
  container.append(button);
}
shortcut(document.querySelector('.desktop-icons'), 'desktop-icon', 'San Andreas');
shortcut(document.querySelector('.start-primary'), 'start-game', 'San Andreas · Solo preview');

new MutationObserver(async () => {
  const open = app.classList.contains('is-open');
  if (!open) {
    attempt++;
    frame.removeAttribute('src');
    return;
  }
  if (frame.hasAttribute('src')) return;
  const current = ++attempt;
  status.hidden = false;
  status.textContent = 'Opening San Andreas…';
  try {
    const response = await fetch(runtime, { cache: 'no-store' });
    if (!response.ok) throw new Error('The San Andreas runtime could not be loaded. Reload Winchester OS and try again.');
    if (current !== attempt || !app.classList.contains('is-open')) return;
    frame.src = runtime.href;
    status.hidden = true;
  } catch (error) {
    if (current === attempt) status.textContent = error.message;
  }
}).observe(app, { attributes: true, attributeFilter: ['class'] });
