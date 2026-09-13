const socket = io();

const revealEl = document.getElementById('reveal');
const cardEl = document.getElementById('card');
const viewerEl = document.getElementById('viewer');
const imageEl = document.getElementById('image');
const fallbackEl = document.getElementById('fallback');
const nameEl = document.getElementById('name');
const rarityEl = document.getElementById('rarity');
const mergedBadgeEl = document.getElementById('merged-badge');
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
const notifyMergedEl = document.getElementById('notify-merged');
const notifySeriesEl = document.getElementById('notify-series');
const notifyArtistEl = document.getElementById('notify-artist');
const notifyDescriptionEl = document.getElementById('notify-description');

const collectionEl = document.getElementById('collection');
const collectionTitleEl = document.getElementById('collection-title');
const collectionCountEl = document.getElementById('collection-count');
const collectionListEl = document.getElementById('collection-list');

const fusionFlashEl = document.getElementById('fusion-flash');
const fusionEl = document.getElementById('fusion');
const fusionParticlesEl = document.getElementById('fusion-particles');

const disconnectEl = document.getElementById('disconnect');
const disconnectTextEl = document.getElementById('disconnect-text');

let revealDuration = 6000;
let revealStyle = 'card';
let collectionStyle = 'card';
let collectionTimer = null;
const COLLECTION_DURATION = 15000;
const FUSION_DURATION = 1300;

let serverConnected = true;
let twitchConnected = true;
let twitchConfigured = false;

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

function playSoundFile(file) {
  return new Promise((resolve) => {
    if (!file) { resolve(); return; }
    const audio = getAudio(file);
    audio.currentTime = 0;
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    audio.addEventListener('ended', finish, { once: true });
    audio.addEventListener('error', finish, { once: true });
    setTimeout(finish, 20000);
    const p = audio.play();
    if (p && p.catch) {
      p.catch(() => {
        // Unmuted autoplay is blocked until a user gesture (or OBS is launched
        // with --autoplay-policy=no-user-gesture-required). Best-effort: play
        // muted (always allowed), then unmute.
        audio.muted = true;
        audio.play()
          .then(() => { audio.muted = false; })
          .catch(finish);
      });
    }
  });
}

function playSound(rarity) {
  if (rarity) playSoundFile(rarity.sound);
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
  if (typeof state.twitchConnected === 'boolean') twitchConnected = state.twitchConnected;
  if (typeof state.twitchConfigured === 'boolean') twitchConfigured = state.twitchConfigured;
  updateDisconnect();
});

socket.on('connect', () => { serverConnected = true; updateDisconnect(); });
socket.on('disconnect', () => { serverConnected = false; updateDisconnect(); });
socket.on('connect_error', () => { serverConnected = false; updateDisconnect(); });
socket.on('status', (s) => {
  if (typeof s.twitchConnected === 'boolean') { twitchConnected = s.twitchConnected; updateDisconnect(); }
});

socket.on('gacha:reveal', (payload) => {
  queue.push(payload);
  processQueue();
});

socket.on('collection:show', (data) => showCollection(data));

function updateDisconnect() {
  if (!serverConnected) {
    disconnectTextEl.textContent = 'Application unreachable — reconnecting…';
    disconnectEl.classList.remove('hidden');
  } else if (twitchConfigured && !twitchConnected) {
    disconnectTextEl.textContent = 'Twitch connection lost';
    disconnectEl.classList.remove('hidden');
  } else {
    disconnectEl.classList.add('hidden');
  }
}

function processQueue() {
  if (busy || queue.length === 0) return;
  busy = true;
  const payload = queue.shift();

  if (payload.merged) {
    showFusion(payload);
    const animDone = new Promise((r) => setTimeout(r, FUSION_DURATION));
    const soundDone = playSoundFile(payload.mergeSound);
    Promise.all([animDone, soundDone]).then(() => {
      fusionEl.classList.add('hidden');
      triggerFusionFlash();
      playSound(payload.rarity);
      revealResult(payload, true);
    });
  } else {
    playSound(payload.rarity);
    revealResult(payload, false);
  }
}

function revealResult(payload, isFusion) {
  if (revealStyle === 'notification') showNotification(payload, isFusion);
  else showCard(payload, isFusion);

  setTimeout(() => {
    hideAll();
    busy = false;
    processQueue();
  }, revealDuration);
}

function hideAll() {
  revealEl.classList.add('hidden');
  notifyEl.classList.add('hidden');
  fusionEl.classList.add('hidden');
}

function triggerFusionFlash() {
  fusionFlashEl.classList.remove('active');
  void fusionFlashEl.offsetWidth;
  fusionFlashEl.classList.add('active');
}

function showFusion(payload) {
  const sacrificed = (payload.sacrificed || []).slice(0, 6);
  const particles = fusionParticlesEl;
  particles.innerHTML = '';

  const n = Math.max(sacrificed.length, 1);
  const cx = 160;
  const cy = 160;
  const radius = 138;
  sacrificed.forEach((s, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const el = document.createElement('div');
    el.className = 'fusion-particle';
    el.style.left = `${cx + Math.cos(angle) * radius - 32}px`;
    el.style.top = `${cy + Math.sin(angle) * radius - 32}px`;
    el.style.animationDelay = `${(i * 0.12).toFixed(2)}s`;
    el.innerHTML = s.image
      ? `<img src="/plushies/${encodeURIComponent(s.image)}" alt="">`
      : '<span class="p-emoji">🧸</span>';
    particles.appendChild(el);
  });

  fusionEl.classList.remove('hidden');
}

function showCard(payload, isFusion) {
  const { displayName, plushie, rarity } = payload;
  const color = rarity && rarity.color ? rarity.color : '#ffffff';

  cardEl.style.setProperty('--rarity-color', color);
  viewerEl.textContent = `@${displayName}`;
  setImage(imageEl, fallbackEl, plushie);
  nameEl.textContent = plushie.name;
  rarityEl.textContent = rarity ? rarity.name : '?';
  mergedBadgeEl.style.display = payload.merged ? 'inline-block' : 'none';
  seriesEl.textContent = plushie.series ? `Series: ${plushie.series}` : '';
  artistEl.style.display = plushie.artist ? '' : 'none';
  artistEl.textContent = plushie.artist ? `Art by ${plushie.artist}` : '';
  descriptionEl.textContent = plushie.description || '';

  revealEl.classList.remove('hidden');
  cardEl.classList.remove('pop', 'fusion');
  void cardEl.offsetWidth;
  cardEl.classList.add(isFusion ? 'fusion' : 'pop');
}

function showNotification(payload, isFusion) {
  const { displayName, plushie, rarity } = payload;
  const color = rarity && rarity.color ? rarity.color : '#ffffff';

  notifyCardEl.style.setProperty('--rarity-color', color);
  notifyViewerEl.textContent = `@${displayName}`;
  setImage(notifyImageEl, notifyFallbackEl, plushie);
  notifyNameEl.textContent = plushie.name;
  notifyRarityEl.textContent = rarity ? rarity.name : '?';
  notifyMergedEl.style.display = payload.merged ? 'inline-block' : 'none';
  notifySeriesEl.textContent = plushie.series ? `Series: ${plushie.series}` : '';
  notifyArtistEl.style.display = plushie.artist ? '' : 'none';
  notifyArtistEl.textContent = plushie.artist ? `Art by ${plushie.artist}` : '';
  notifyDescriptionEl.textContent = plushie.description || '';

  notifyEl.classList.remove('hidden');
  notifyCardEl.classList.remove('fusion');
  void notifyCardEl.offsetWidth;
  if (isFusion) notifyCardEl.classList.add('fusion');
}

function startAutoScroll(el) {
  clearInterval(el._scrollTimer);
  el.scrollTop = 0;
  if (el.scrollHeight <= el.clientHeight) return;
  let dir = 1;
  let wait = 0;
  el._scrollTimer = setInterval(() => {
    const max = el.scrollHeight - el.clientHeight;
    if (wait > 0) { wait--; return; }
    el.scrollTop += dir;
    if (el.scrollTop >= max) { dir = -1; wait = 50; }
    else if (el.scrollTop <= 0) { dir = 1; wait = 50; }
  }, 25);
}

function showCollection(data) {
  clearInterval(collectionListEl._scrollTimer);
  collectionListEl.scrollTop = 0;
  collectionEl.classList.toggle('corner', collectionStyle === 'notification');

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
      return `<div class="c-card" style="--rarity-color:${escapeHtml(e.rarityColor || '#888888')}">
        ${thumb}
        <div class="c-name">${escapeHtml(e.name)}</div>
        <span class="c-count">×${e.count}</span>
      </div>`;
    }).join('');
  }

  collectionEl.classList.remove('hidden');
  clearTimeout(collectionTimer);
  collectionTimer = setTimeout(() => {
    collectionEl.classList.add('hidden');
    clearInterval(collectionListEl._scrollTimer);
  }, COLLECTION_DURATION);

  if (data.entries && data.entries.length > 0) startAutoScroll(collectionListEl);
}
