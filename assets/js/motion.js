/* Native, finite motion. Content never depends on an animation to become visible. */
const preference = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const active = new Map();
const seen = new WeakSet();
let observer;
export const scrollBehavior = () => preference?.matches ? 'instant' : 'smooth';

function entrance(element, { delay = 0, distance = 18, duration = 560 } = {}) {
  if (!element || preference?.matches || typeof element.animate !== 'function') return;
  active.get(element)?.cancel();
  const animation = element.animate([
    { opacity: 0, transform: `translateY(${distance}px)` },
    { opacity: 1, transform: 'translateY(0)' }
  ], { duration, delay, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' });
  active.set(element, animation);
  const finish = () => { if (active.get(element) === animation) active.delete(element); };
  animation.onfinish = finish;
  animation.oncancel = finish;
}

export function animateStep(element) {
  entrance(element, { distance: 10, duration: 280 });
}

window.ShiaMotion = Object.freeze({ animateStep });

function reveal(section) {
  if (seen.has(section)) return;
  seen.add(section);
  section.dataset.motionRevealed = 'true';
  observer?.unobserve(section);
  // Animate the composition together so controls keep their spatial relationships.
  entrance(section, { distance: 20, duration: 620 });
}

function init() {
  document.querySelectorAll('.hero-copy > *').forEach((element, index) => {
    entrance(element, { delay: index * 45, distance: 14, duration: 520 });
  });
  entrance(document.querySelector('.hero-visual'), { delay: 80, distance: 20, duration: 680 });
  const sections = document.querySelectorAll('.process-section, .story-band, .occasions-section, .pricing-section, .faq-section, .closing-section');
  if (!preference?.matches && typeof IntersectionObserver === 'function') {
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting && !entry.target.closest('.hidden')) reveal(entry.target); });
    }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
    sections.forEach(section => observer.observe(section));
  }
  const updatePreference = () => {
    if (!preference.matches) return;
    active.forEach(animation => animation.cancel());
    active.clear();
    observer?.disconnect();
    sections.forEach(section => { seen.add(section); section.dataset.motionRevealed = 'true'; });
  };
  if (preference?.addEventListener) preference.addEventListener('change', updatePreference);
  else preference?.addListener?.(updatePreference);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
