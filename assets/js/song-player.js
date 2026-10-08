import { t } from './i18n.js';

export function initSongPlayer() {
  const audio = document.getElementById('featuredSong');
  const card = document.getElementById('songCard');
  if (!audio || !card || audio.dataset.playerReady) return;
  audio.dataset.playerReady = 'true';
  const picker = document.getElementById('picker');
  const customer = document.getElementById('customerApp');
  const state = document.getElementById('songState');
  const error = document.getElementById('songError');
  const elapsed = document.getElementById('songElapsed');
  const duration = document.getElementById('songDuration');
  const inCustomerView = () => !picker?.classList.contains('hidden') && !customer?.classList.contains('hidden');
  const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

  function setText(element, source) {
    const text = source ? t(source) : '';
    if (source) element.dataset.i18n = source;
    else delete element.dataset.i18n;
    if (element.textContent !== text) element.textContent = text;
  }
  function update() {
    const total = Number.isFinite(audio.duration) ? audio.duration : 199.44;
    const current = Math.max(0, Math.min(total, audio.currentTime || 0));
    const playing = !audio.paused && !audio.ended;
    card.classList.toggle('is-playing', playing);
    card.style.setProperty('--song-progress', `${Math.min(100, current / total * 100)}%`);
    elapsed.textContent = formatTime(current);
    duration.textContent = formatTime(total);
    setText(state, audio.ended ? 'Canción completada' : playing ? 'Reproduciendo' : current > 0 ? 'En pausa' : 'Pulse reproducir para escuchar');
  }
  function stopForContext() {
    if (document.hidden || !inCustomerView()) audio.pause();
  }
  function reportError() {
    setText(error, 'No se pudo cargar esta canción. Puede seguir creando su canción.');
    audio.pause(); update();
  }

  document.querySelectorAll('[data-play-song]').forEach(link => link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    if (!inCustomerView() || document.hidden) return;
    if (audio.ended) audio.currentTime = 0;
    void audio.play().catch(failure => {
      if (failure.name === 'AbortError') return;
      if (failure.name === 'NotAllowedError') setText(error, 'Pulse reproducir en el reproductor para escuchar.');
      else reportError();
    });
  }));
  // A user can switch between the native song player and either film player.
  // Silent decorative video can run without interrupting a song.
  document.addEventListener('play', event => {
    const media = event.target;
    if (!(media instanceof HTMLMediaElement)) return;
    if (media === audio) {
      if (document.hidden || !inCustomerView()) { audio.pause(); return; }
      for (const other of document.querySelectorAll('audio,video')) if (other !== audio) {
        if (other.id === 'heroFilm') other.muted = true;
        other.pause();
      }
      setText(error, ''); update();
    } else if (media.id !== 'heroFilm' || !media.muted) audio.pause();
  }, true);
  document.addEventListener('volumechange', event => {
    const other = event.target;
    if (other instanceof HTMLMediaElement && other !== audio && !other.paused && !other.muted && other.volume > 0) audio.pause();
  }, true);
  for (const event of ['play','pause','ended','timeupdate','loadedmetadata']) audio.addEventListener(event, update);
  audio.addEventListener('loadedmetadata', () => setText(error, ''));
  audio.addEventListener('error', reportError);
  document.addEventListener('visibilitychange', stopForContext);
  window.addEventListener('pagehide', () => audio.pause());
  window.addEventListener('pageshow', stopForContext);
  window.addEventListener('shia:languagechange', update);
  const contexts = new MutationObserver(stopForContext);
  for (const target of [picker, customer]) if (target) contexts.observe(target, { attributes:true, attributeFilter:['class'] });
  update();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSongPlayer, {once:true});
else initSongPlayer();
