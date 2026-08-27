const socket = io();

const revealEl = document.getElementById('reveal');
const cardEl = document.getElementById('card');
const viewerEl = document.getElementById('viewer');
const imageEl = document.getElementById('image');
const fallbackEl = document.getElementById('fallback');
const nameEl = document.getElementById('name');
const rarityEl = document.getElementById('rarity');
const seriesEl = document.getElementById('series');
const artistEl = document.getElementById('artist');
const descriptionEl = document.getElementById('description');

const notifyEl = document.getElementById('notify');
const notifyCardEl = document.getElementById('notify-card');
const notifyImageEl = document.getElementById('notify-image');
const notifyFallbackEl = document.getElementById('notify-fallback');
const notifyViewerEl = document.getElementById('notify-viewer');
const notifyNameEl = document.getElementById('notify-name');
const notifyRarityEl = document.getElementById('notify-rarity');
const notifySeriesEl = document.getElementById('notify-series');
const notifyArtistEl = document.getElementById('notify-artist');
const notifyDescriptionEl = document.getElementById('notify-description');

const collectionEl = document.getElementById('collection');
const collectionTitleEl = document.getElementById('collection-title');
const collectionCountEl = document.getElementById('collection-count');
const collectionListEl = document.getElementById('collection-list');

let revealDuration = 6000;
let revealStyle = 'card';
let collectionStyle = 'card';
let collectionTimer = null;
const COLLECTION_DURATION = 12000;

const queue = [];
let busy = false;

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function setImage(imgEl, fbEl, plushie) {
  if (plushie.image) {
    imgEl.src = `/plushies/${encodeURIComponent(plushie.image)}`;
    imgEl.style.display = 'block';
    fbEl.style.display = 'none';
  } else {
    imgEl.removeAttribute('src');
    imgEl.style.display = 'none';
    fbEl.style.display = 'block';
  }
}

const soundCache = new Map();

function getAudio(sound) {
  let audio = soundCache.get(sound);
  if (!audio) {
    audio = new Audio(`/sounds/${encodeURIComponent(sound)}`);
    audio.preload = 'auto';
    audio.volume = 1;
    soundCache.set(sound, audio);
  }
  return audio;
}

function playSound(rarity) {
  if (!rarity || !rarity.sound) return;
  const audio = getAudio(rarity.sound);
  audio.currentTime = 0;
  const p = audio.play();
  if (p && p.catch) {
    p.catch(() => {
      // Unmuted autoplay is blocked until a user gesture (or OBS is launched
      // with --autoplay-policy=no-user-gesture-required). Best-effort: play
      // muted (always allowed), then unmute.
      audio.muted = true;
      audio.play()
        .then(() => { audio.muted = false; })
        .catch(() => {});
    });
  }
}

// Unlock audio on the first interaction (handy when previewing in a browser).
function unlockAudio() {
  for (const audio of soundCache.values()) {
    audio.muted = true;
    const p = audio.play();
    if (p && p.then) {
      p.then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      }).catch(() => {});
    }
  }
}
document.addEventListener('pointerdown', unlockAudio, { once: true });
document.addEventListener('keydown', unlockAudio, { once: true });

imageEl.addEventListener('error', () => {
  imageEl.style.display = 'none';
  fallbackEl.style.display = 'block';
});

notifyImageEl.addEventListener('error', () => {
  notifyImageEl.style.display = 'none';
  notifyFallbackEl.style.display = 'block';
});

collectionListEl.addEventListener('error', (e) => {
  if (e.target.tagName === 'IMG') e.target.style.display = 'none';
}, true);

socket.on('state', (state) => {
  if (state.settings) {
    if (state.settings.revealDurationMs) revealDuration = state.settings.revealDurationMs;
    if (state.settings.revealStyle) revealStyle = state.settings.revealStyle;
    if (state.settings.collectionStyle) collectionStyle = state.settings.collectionStyle;
  }
});

socket.on('gacha:reveal', (payload) => {
  queue.push(payload);
  processQueue();
});

socket.on('collection:show', (data) => showCollection(data));

function processQueue() {
  if (busy || queue.length === 0) return;
  busy = true;
  const payload = queue.shift();
  playSound(payload.rarity);
  if (revealStyle === 'notification') showNotification(payload);
  else showCard(payload);
}

function showCard(payload) {
  const { displayName, plushie, rarity } = payload;
  const color = rarity && rarity.color ? rarity.color : '#ffffff';

  cardEl.style.setProperty('--rarity-color', color);
  viewerEl.textContent = `@${displayName}`;
  setImage(imageEl, fallbackEl, plushie);
  nameEl.textContent = plushie.name;
  rarityEl.textContent = rarity ? rarity.name : '?';
  seriesEl.textContent = plushie.series ? `Series: ${plushie.series}` : '';
  artistEl.style.display = plushie.artist ? '' : 'none';
  artistEl.textContent = plushie.artist ? `Art by ${plushie.artist}` : '';
  descriptionEl.textContent = plushie.description || '';

  revealEl.classList.remove('hidden');
  cardEl.classList.remove('pop');
  void cardEl.offsetWidth;
  cardEl.classList.add('pop');

  setTimeout(() => {
    revealEl.classList.add('hidden');
    busy = false;
    processQueue();
  }, revealDuration);
}

function showNotification(payload) {
  const { displayName, plushie, rarity } = payload;
  const color = rarity && rarity.color ? rarity.color : '#ffffff';

  notifyCardEl.style.setProperty('--rarity-color', color);
  notifyViewerEl.textContent = `@${displayName}`;
  setImage(notifyImageEl, notifyFallbackEl, plushie);
  notifyNameEl.textContent = plushie.name;
  notifyRarityEl.textContent = rarity ? rarity.name : '?';
  notifySeriesEl.textContent = plushie.series ? `Series: ${plushie.series}` : '';
  notifyArtistEl.style.display = plushie.artist ? '' : 'none';
  notifyArtistEl.textContent = plushie.artist ? `Art by ${plushie.artist}` : '';
  notifyDescriptionEl.textContent = plushie.description || '';

  notifyEl.classList.remove('hidden');

  setTimeout(() => {
    notifyEl.classList.add('hidden');
    busy = false;
    processQueue();
  }, revealDuration);
}

function showCollection(data) {
  collectionTitleEl.textContent = `${data.displayName || data.viewer}'s collection`;

  if (!data.entries || data.entries.length === 0) {
    collectionCountEl.textContent = 'No plushies yet';
    collectionListEl.innerHTML = '<div class="c-empty">Type !gacha to start collecting!</div>';
  } else {
    collectionCountEl.textContent = `${data.total} plushies · ${data.unique} unique`;
    collectionListEl.innerHTML = data.entries.map((e) => {
      const thumb = e.image
        ? `<img class="c-thumb" src="/plushies/${encodeURIComponent(e.image)}" alt="">`
        : '<span class="c-thumb c-thumb-empty">🧸</span>';
      return `<div class="c-row" style="border-left-color:${escapeHtml(e.rarityColor || '#888888')}">
        ${thumb}<span class="c-name">${escapeHtml(e.name)}</span><span class="c-count">×${e.count}</span>
      </div>`;
    }).join('');
  }

  collectionEl.classList.toggle('corner', collectionStyle === 'notification');
  collectionEl.classList.remove('hidden');
  clearTimeout(collectionTimer);
  collectionTimer = setTimeout(() => collectionEl.classList.add('hidden'), COLLECTION_DURATION);
}
