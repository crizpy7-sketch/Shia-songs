import { t } from './i18n.js';

// One eight-second composition. Text and customer controls never move.
export function initHeroMotion() {
  const hero = document.querySelector('.hero');
  const button = document.getElementById('heroMotionToggle');
  if (!hero || !button) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let animations = [], manuallyPaused = false, inView = true, finished = false;
  function label(source) {
    const text = button.querySelector('[data-i18n]');
    text.dataset.i18n = source;
    text.textContent = t(source);
  }
  function sync() {
    const usable = animations.length && !preference.matches && !finished;
    const visible = !document.hidden && !hero.closest('.hidden') && inView;
    const paused = manuallyPaused || !visible;
    animations.forEach(animation => paused ? animation.pause() : animation.play());
    hero.dataset.heroMotion = preference.matches ? 'reduced' : finished ? 'finished' : !animations.length ? 'unavailable' : paused ? 'paused' : 'running';
    // A control cannot disappear while it has keyboard focus.
    button.hidden = !usable && document.activeElement !== button;
    button.disabled = !usable;
    button.setAttribute('aria-pressed', String(manuallyPaused));
    label(finished ? 'Movimiento completado' : manuallyPaused ? 'Reanudar movimiento' : 'Pausar movimiento');
  }
  if (!preference.matches && typeof hero.animate === 'function') {
    const layers = [
      ['.hero-photo', [{ translate: '0 0', rotate: '0deg' }, { translate: '-18px 8px', rotate: '-2deg', offset: .5 }, { translate: '0 0', rotate: '0deg' }]],
      ['.listener-photo', [{ translate: '0 0', rotate: '0deg' }, { translate: '15px -16px', rotate: '5deg', offset: .5 }, { translate: '0 0', rotate: '0deg' }]],
      ['.record', [{ rotate: '0deg', translate: '0 0' }, { rotate: '180deg', translate: '-12px 0', offset: .5 }, { rotate: '360deg', translate: '0 0' }]],
      ['.sound-note', [{ translate: '0 0' }, { translate: '0 -9px', offset: .5 }, { translate: '0 0' }]]
    ];
    animations = layers.map(([selector, frames]) => hero.querySelector(selector)?.animate(frames, { duration: 8000, easing: 'ease-in-out' })).filter(Boolean);
    Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(() => {
      finished = true; animations = []; sync();
    });
  }
  button.addEventListener('click', () => { manuallyPaused = !manuallyPaused; sync(); });
  button.addEventListener('blur', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => { inView = false; sync(); });
  window.addEventListener('pageshow', () => { inView = true; sync(); });
  new MutationObserver(sync).observe(document.getElementById('picker'), { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(sync).observe(document.getElementById('customerApp'), { attributes: true, attributeFilter: ['class'] });
  if (typeof IntersectionObserver === 'function') new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting; sync();
  }, { threshold: .05 }).observe(hero);
  preference.addEventListener('change', () => {
    if (preference.matches) { animations.forEach(animation => animation.cancel()); animations = []; }
    sync();
  });
  sync();
}
