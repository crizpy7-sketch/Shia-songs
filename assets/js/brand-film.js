import { t, getLanguage } from './i18n.js';

// A finite decorative film. Questionnaires and business state do not depend on it.
export function initBrandFilm() {
  const get = id => document.getElementById(id);
  const hero = get('heroFilm'), story = get('storyFilm'), dialog = get('brandFilmDialog');
  if (!hero || !story || !dialog) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const pause = get('filmPause'), sound = get('filmSound'), open = get('filmOpen');
  const picker = get('picker'), customer = get('customerApp');
  const scenes = ['Una historia', 'Un recuerdo', 'Una emoción', 'Una melodía', 'SHIA SONGS'];
  let manualPause = preference.matches, inView = true, frame = 0, modalWasRunning = false;
  let suspendedHero = false, suspendedStory = false, revision = 0;
  let desiredHeroTime = null, desiredStoryTime = null;

  hero.controls = false;
  get('filmControls').hidden = false;

  const hasContext = () => !picker.classList.contains('hidden') && !customer.classList.contains('hidden');
  const allowed = () => !document.hidden && inView && hasContext() && !dialog.open;
  const setName = (button, source) => {
    button.dataset.i18nAriaLabel = source;
    button.setAttribute('aria-label', t(source));
  };
  const message = source => {
    const element = get('filmMessage');
    if (source) { element.dataset.i18n = source; element.textContent = t(source); }
    else { delete element.dataset.i18n; element.textContent = ''; }
  };

  function update() {
    const time = Math.max(0, Math.min(15, hero.currentTime || 0));
    const ended = hero.ended || time >= 14.97;
    const playing = !hero.paused && !ended;
    get('filmTime').textContent = `00:${String(Math.floor(time)).padStart(2, '0')}`;
    get('filmProgress').style.setProperty('--film-progress', String(time / 15));
    const phase = get('filmPhase'), source = ended ? 'Película completada' : scenes[Math.min(4, Math.floor(time / 3))];
    phase.dataset.i18n = source; phase.textContent = t(source);
    get('filmPauseIcon').toggleAttribute('hidden', !playing);
    get('filmPlayIcon').toggleAttribute('hidden', playing || ended);
    get('filmReplayIcon').toggleAttribute('hidden', !ended);
    pause.setAttribute('aria-pressed', String(!playing));
    setName(pause, ended ? 'Repetir película' : playing ? 'Pausar película' : 'Reanudar película');
    const audible = !hero.muted && hero.volume > 0;
    sound.setAttribute('aria-pressed', String(audible));
    setName(sound, audible ? 'Desactivar música de la película' : 'Activar música de la película');
    get('filmSoundWaves').toggleAttribute('hidden', !audible);
    get('filmSoundCross').toggleAttribute('hidden', audible);
  }

  function tick() {
    update();
    if (!hero.paused && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function playbackChanged() {
    cancelAnimationFrame(frame); update();
    if (!hero.paused && !document.hidden) frame = requestAnimationFrame(tick);
  }
  async function play(video, user = false) {
    const currentRevision = revision;
    try {
      await video.play();
      if (currentRevision !== revision) return;
      message(null);
    } catch (error) {
      if (currentRevision !== revision || error.name === 'AbortError') return;
      if (user && error.name === 'NotAllowedError') message('Pulse reproducir para ver la película.');
      else if (error.name !== 'NotAllowedError') message('No se pudo cargar la película. Puede continuar creando su canción.');
      update();
    }
  }
  function suspend() {
    if (!hero.paused) suspendedHero = true;
    hero.pause();
    if (!story.paused) suspendedStory = true;
    story.pause();
    cancelAnimationFrame(frame);
  }
  function syncContext() {
    if (!allowed()) {
      if (!hero.paused) suspendedHero = true;
      hero.pause();
    } else if (suspendedHero && !manualPause && !preference.matches && !hero.ended) {
      suspendedHero = false; void play(hero);
    }
  }

  pause.addEventListener('click', () => {
    if (hero.paused || hero.ended) {
      manualPause = false; suspendedHero = false;
      if (hero.ended || hero.currentTime >= 14.97) hero.currentTime = 0;
      if (allowed()) void play(hero, true);
    } else { manualPause = true; hero.pause(); }
  });
  sound.addEventListener('click', () => {
    hero.muted = !hero.muted;
    if (!hero.muted) hero.volume = 1;
    update();
  });
  open.addEventListener('click', () => {
    modalWasRunning = !hero.paused;
    hero.pause(); story.currentTime = 0; story.muted = false; story.volume = 1;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    get('filmClose').focus();
    void play(story, true);
  });
  function close() {
    if (typeof dialog.close === 'function') dialog.close();
    else { dialog.removeAttribute('open'); dialog.dispatchEvent(new Event('close')); }
  }
  get('filmClose').addEventListener('click', close);
  dialog.addEventListener('close', () => {
    story.pause(); story.muted = true; suspendedStory = false;
    if (modalWasRunning && allowed() && !manualPause && !preference.matches && !hero.ended) void play(hero);
    modalWasRunning = false; open.focus();
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  });
  get('filmStartStory').addEventListener('click', () => { modalWasRunning = false; close(); });

  const sources = language => ({video:`assets/media/shia-story-${language}.mp4`,poster:`assets/media/shia-story-${language}.jpg`});
  function languageChanged() {
    revision++;
    const language = getLanguage(), source = sources(language);
    const resumeHero = !hero.paused, resumeStory = !story.paused;
    desiredHeroTime = Math.min(14.98, hero.currentTime || 0);
    desiredStoryTime = Math.min(14.98, story.currentTime || 0);
    for (const video of [hero, story]) {
      video.pause(); video.poster = source.poster;
      video.querySelector('source').setAttribute('src', source.video);
      for (const track of video.querySelectorAll('track')) track.default = track.srclang === language;
      video.load();
    }
    if (resumeHero && allowed()) void play(hero);
    if (resumeStory && dialog.open && !document.hidden) void play(story);
    update();
  }
  hero.addEventListener('loadedmetadata', () => {
    if (desiredHeroTime !== null) { hero.currentTime = desiredHeroTime; desiredHeroTime = null; }
    update();
  });
  story.addEventListener('loadedmetadata', () => {
    if (desiredStoryTime !== null) { story.currentTime = desiredStoryTime; desiredStoryTime = null; }
  });
  for (const event of ['play','pause','ended']) hero.addEventListener(event, playbackChanged);
  hero.addEventListener('timeupdate', update);
  hero.addEventListener('volumechange', update);
  for (const video of [hero, story]) video.addEventListener('error', () => {
    message('No se pudo cargar la película. Puede continuar creando su canción.'); update();
  });
  window.addEventListener('shia:languagechange', languageChanged);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspend();
    else {
      syncContext();
      if (suspendedStory && dialog.open) { suspendedStory = false; void play(story); }
    }
  });
  window.addEventListener('pagehide', suspend);
  window.addEventListener('pageshow', syncContext);
  const contexts = new MutationObserver(syncContext);
  for (const target of [picker, customer]) contexts.observe(target,{attributes:true,attributeFilter:['class']});
  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver(entries => { inView = entries[0].isIntersecting; syncContext(); },{threshold:.12}).observe(get('brandFilm'));
  }
  preference.addEventListener('change', () => {
    if (preference.matches) { manualPause = true; suspend(); suspendedStory = false; }
    update();
  });

  if (getLanguage() === 'es') languageChanged();
  update();
  if (!preference.matches && allowed()) void play(hero);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBrandFilm, {once:true});
else initBrandFilm();
