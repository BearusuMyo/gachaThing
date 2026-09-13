const state = { rarities: [], plushies: [], settings: {}, merges: [], images: [], sounds: [] };
let editingRarity = null;
let editingPlushie = null;
let editingMerge = null;

const $ = (id) => document.getElementById(id);

async function api(path, method = 'GET', body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function rarityById(id) {
  return state.rarities.find((r) => r.id === id);
}

function emptyItem(text) {
  return `<mdui-list-item nonclickable><span slot="custom" class="empty">${text}</span></mdui-list-item>`;
}

function renderRarities() {
  const list = $('rarity-list');
  if (state.rarities.length === 0) {
    list.innerHTML = emptyItem('No rarities yet. Add one above.');
    return;
  }
  list.innerHTML = state.rarities.map((r) => `
    <mdui-list-item nonclickable>
      <div slot="custom" class="row">
        <span class="swatch" style="background:${escapeHtml(r.color)}"></span>
        <div class="row-meta">
          <div class="row-title">${escapeHtml(r.name)}</div>
          <div class="row-sub">weight ${r.weight}</div>
        </div>
        <mdui-button-icon icon="edit" data-edit-rarity="${r.id}"></mdui-button-icon>
        <mdui-button-icon icon="delete" data-del-rarity="${r.id}"></mdui-button-icon>
      </div>
    </mdui-list-item>
  `).join('');
}

function renderPlushies() {
  const list = $('plushie-list');
  if (state.plushies.length === 0) {
    list.innerHTML = emptyItem('No plushies yet. Drop images into public/plushies/ or use the FAB to add one.');
    return;
  }
  list.innerHTML = state.plushies.map((p) => {
    const rarity = rarityById(p.rarity);
    const badge = rarity
      ? `<span class="rarity-badge" style="background:${escapeHtml(rarity.color)}">${escapeHtml(rarity.name)}</span>`
      : '<span class="rarity-badge" style="background:#444;color:#fff">none</span>';
    const thumb = p.image
      ? `<img class="thumb" src="/plushies/${encodeURIComponent(p.image)}" alt="">`
      : '<span class="thumb-fallback">🧸</span>';
    const sub = [p.series, p.artist ? `by ${p.artist}` : ''].filter(Boolean).join(' · ');
    return `
      <mdui-list-item nonclickable>
        <div slot="custom" class="row">
          ${thumb}
          <div class="row-meta">
            <div class="row-title">${escapeHtml(p.name)}</div>
            <div class="row-sub">${escapeHtml(sub || '—')}</div>
          </div>
          ${badge}
          <mdui-button-icon icon="visibility" data-reveal-plushie="${p.id}"></mdui-button-icon>
          <mdui-button-icon icon="edit" data-edit-plushie="${p.id}"></mdui-button-icon>
          <mdui-button-icon icon="delete" data-del-plushie="${p.id}"></mdui-button-icon>
        </div>
      </mdui-list-item>
    `;
  }).join('');
}

function renderRaritySelect() {
  const select = $('plushie-rarity');
  select.innerHTML = state.rarities.length
    ? state.rarities.map((r) =>
        `<mdui-menu-item value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</mdui-menu-item>`
      ).join('')
    : '<mdui-menu-item value="">No rarities</mdui-menu-item>';
}

function renderImageSelect() {
  const select = $('plushie-image');
  select.innerHTML = '<mdui-menu-item value="">No image</mdui-menu-item>' +
    state.images.map((img) =>
      `<mdui-menu-item value="${escapeHtml(img)}">${escapeHtml(img)}</mdui-menu-item>`
    ).join('');
}

function renderSoundSelect() {
  const select = $('rarity-sound');
  select.innerHTML = '<mdui-menu-item value="">No sound</mdui-menu-item>' +
    state.sounds.map((s) =>
      `<mdui-menu-item value="${escapeHtml(s)}">${escapeHtml(s)}</mdui-menu-item>`
    ).join('');
}

function renderMergeSourceSelect() {
  const select = $('merge-source');
  select.innerHTML = state.rarities.length
    ? state.rarities.map((r) =>
        `<mdui-menu-item value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</mdui-menu-item>`
      ).join('')
    : '<mdui-menu-item value="">No rarities</mdui-menu-item>';
}

function renderMergeSoundSelect() {
  const select = $('merge-sound');
  select.innerHTML = '<mdui-menu-item value="">No sound</mdui-menu-item>' +
    state.sounds.map((s) =>
      `<mdui-menu-item value="${escapeHtml(s)}">${escapeHtml(s)}</mdui-menu-item>`
    ).join('');
}

function renderMerges() {
  const list = $('merge-list');
  if (state.merges.length === 0) {
    list.innerHTML = emptyItem('No merges yet. Define one above.');
    return;
  }
  list.innerHTML = state.merges.map((m) => {
    const r = rarityById(m.sourceRarity);
    const sub = [`+${m.bonusWeight} weight`, m.superiorOnly ? 'superior only' : null, m.sound ? `sound: ${m.sound}` : null].filter(Boolean).join(' · ');
    return `
      <mdui-list-item nonclickable>
        <div slot="custom" class="row">
          <div class="row-meta">
            <div class="row-title">${escapeHtml(r ? r.name : m.sourceRarity)} × ${m.count}</div>
            <div class="row-sub">${escapeHtml(sub || '—')}</div>
          </div>
          <mdui-button-icon icon="auto_awesome" data-simulate-merge="${m.id}"></mdui-button-icon>
          <mdui-button-icon icon="edit" data-edit-merge="${m.id}"></mdui-button-icon>
          <mdui-button-icon icon="delete" data-del-merge="${m.id}"></mdui-button-icon>
        </div>
      </mdui-list-item>
    `;
  }).join('');
}

function renderSettings() {
  $('set-gacha').value = state.settings.commands?.gacha ?? 'gacha';
  $('set-collection').value = state.settings.commands?.collection ?? 'plushies';
  $('set-merge').value = state.settings.commands?.merge ?? 'merge';
  $('set-confirm').value = state.settings.commands?.confirm ?? 'confirm';
  $('set-cooldown').value = String(state.settings.cooldownSeconds ?? 30);
  $('set-reveal').value = String(state.settings.revealDurationMs ?? 6000);
  $('set-reveal-style').value = state.settings.revealStyle ?? 'card';
  $('set-collection-style').value = state.settings.collectionStyle ?? 'card';
}

function renderAll() {
  renderRarities();
  renderRaritySelect();
  renderImageSelect();
  renderSoundSelect();
  renderMergeSourceSelect();
  renderMergeSoundSelect();
  renderPlushies();
  renderMerges();
  renderSettings();
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function loadState() {
  Object.assign(state, await api('/api/state'));
  renderAll();
}

// ---- Plushie dialog ------------------------------------------------------

function resetPlushieForm() {
  $('plushie-name').value = '';
  $('plushie-rarity').value = '';
  $('plushie-image').value = '';
  $('plushie-series').value = '';
  $('plushie-artist').value = '';
  $('plushie-description').value = '';
}

function openPlushieDialog(plushie) {
  const imageSelect = $('plushie-image');
  if (plushie) {
    editingPlushie = plushie.id;
    $('plushie-dialog-title').textContent = 'Edit plushie';
    $('plushie-submit').textContent = 'Update plushie';
    if (plushie.image && !state.images.includes(plushie.image)) {
      imageSelect.insertAdjacentHTML('beforeend',
        `<mdui-menu-item value="${escapeHtml(plushie.image)}">${escapeHtml(plushie.image)}</mdui-menu-item>`);
    }
    $('plushie-name').value = plushie.name;
    $('plushie-rarity').value = plushie.rarity || '';
    imageSelect.value = plushie.image || '';
    $('plushie-series').value = plushie.series || '';
    $('plushie-artist').value = plushie.artist || '';
    $('plushie-description').value = plushie.description || '';
  } else {
    editingPlushie = null;
    $('plushie-dialog-title').textContent = 'New plushie';
    $('plushie-submit').textContent = 'Save plushie';
    resetPlushieForm();
  }
  $('plushie-dialog').open = true;
}

// ---- Events -------------------------------------------------------------

$('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/settings', 'PUT', {
      commands: {
        gacha: $('set-gacha').value.trim(),
        collection: $('set-collection').value.trim(),
        merge: $('set-merge').value.trim(),
        confirm: $('set-confirm').value.trim(),
      },
      cooldownSeconds: Number($('set-cooldown').value),
      revealDurationMs: Number($('set-reveal').value),
      revealStyle: $('set-reveal-style').value,
      collectionStyle: $('set-collection-style').value,
    });
    await loadState();
    mdui.snackbar({ message: 'Settings saved' });
  } catch (err) { mdui.snackbar({ message: err.message }); }
});

$('rarity-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    name: $('rarity-name').value.trim(),
    weight: Number($('rarity-weight').value),
    color: $('rarity-color').value,
    sound: $('rarity-sound').value || null,
  };
  try {
    if (editingRarity) {
      await api(`/api/rarities/${editingRarity}`, 'PUT', body);
    } else {
      await api('/api/rarities', 'POST', body);
    }
    cancelRarityEdit();
    await loadState();
    mdui.snackbar({ message: 'Rarity saved' });
  } catch (err) { mdui.snackbar({ message: err.message }); }
});

$('plushie-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    name: $('plushie-name').value.trim(),
    rarity: $('plushie-rarity').value || null,
    image: $('plushie-image').value || null,
    series: $('plushie-series').value.trim(),
    artist: $('plushie-artist').value.trim(),
    description: $('plushie-description').value.trim(),
  };
  try {
    if (editingPlushie) {
      await api(`/api/plushies/${editingPlushie}`, 'PUT', body);
    } else {
      await api('/api/plushies', 'POST', body);
    }
    $('plushie-dialog').open = false;
    editingPlushie = null;
    await loadState();
    mdui.snackbar({ message: 'Plushie saved' });
  } catch (err) { mdui.snackbar({ message: err.message }); }
});

$('new-plushie-fab').addEventListener('click', () => openPlushieDialog(null));

$('plushie-cancel').addEventListener('click', () => {
  $('plushie-dialog').open = false;
});

$('merge-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    sourceRarity: $('merge-source').value,
    count: Number($('merge-count').value),
    bonusWeight: Number($('merge-bonus').value),
    sound: $('merge-sound').value || null,
    superiorOnly: $('merge-superior').checked,
  };
  try {
    if (editingMerge) {
      await api(`/api/merges/${editingMerge}`, 'PUT', body);
    } else {
      await api('/api/merges', 'POST', body);
    }
    cancelMergeEdit();
    await loadState();
    mdui.snackbar({ message: 'Merge saved' });
  } catch (err) { mdui.snackbar({ message: err.message }); }
});

$('test-roll').addEventListener('click', async () => {
  try {
    await api('/api/test-roll', 'POST');
  } catch (err) { mdui.snackbar({ message: err.message }); }
});

$('rescan').addEventListener('click', async () => {
  try {
    await api('/api/rescan', 'POST');
    await loadState();
    mdui.snackbar({ message: 'Images rescanned' });
  } catch (err) { mdui.snackbar({ message: err.message }); }
});

function findInPath(e, selector) {
  const path = e.composedPath ? e.composedPath() : [];
  for (const el of path) {
    if (el && el.matches && el.matches(selector)) return el;
  }
  return null;
}

document.addEventListener('click', async (e) => {
  const editRarity = findInPath(e, '[data-edit-rarity]');
  const delRarity = findInPath(e, '[data-del-rarity]');
  const editPlushie = findInPath(e, '[data-edit-plushie]');
  const delPlushie = findInPath(e, '[data-del-plushie]');
  const revealPlushie = findInPath(e, '[data-reveal-plushie]');
  const editMerge = findInPath(e, '[data-edit-merge]');
  const delMerge = findInPath(e, '[data-del-merge]');
  const simulateMerge = findInPath(e, '[data-simulate-merge]');
  const replayEvent = findInPath(e, '[data-replay-event]');
  const detailEvent = findInPath(e, '[data-detail-event]');

  if (editRarity) {
    const r = rarityById(editRarity.dataset.editRarity);
    if (!r) return;
    const soundSelect = $('rarity-sound');
    if (r.sound && !state.sounds.includes(r.sound)) {
      soundSelect.insertAdjacentHTML('beforeend',
        `<mdui-menu-item value="${escapeHtml(r.sound)}">${escapeHtml(r.sound)}</mdui-menu-item>`);
    }
    $('rarity-name').value = r.name;
    $('rarity-weight').value = String(r.weight);
    $('rarity-color').value = r.color;
    soundSelect.value = r.sound || '';
    editingRarity = r.id;
    $('rarity-submit').textContent = 'Update rarity';
    return;
  }
  if (delRarity) {
    try {
      await mdui.confirm({
        headline: 'Delete rarity?',
        description: 'Plushies using this rarity will lose it.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
      });
    } catch { return; }
    try {
      await api(`/api/rarities/${delRarity.dataset.delRarity}`, 'DELETE');
      await loadState();
    } catch (err) { mdui.snackbar({ message: err.message }); }
    return;
  }
  if (editPlushie) {
    const p = state.plushies.find((x) => x.id === editPlushie.dataset.editPlushie);
    if (!p) return;
    openPlushieDialog(p);
    return;
  }
  if (delPlushie) {
    try {
      await mdui.confirm({
        headline: 'Delete plushie?',
        description: 'This cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
      });
    } catch { return; }
    try {
      await api(`/api/plushies/${delPlushie.dataset.delPlushie}`, 'DELETE');
      await loadState();
    } catch (err) { mdui.snackbar({ message: err.message }); }
    return;
  }
  if (revealPlushie) {
    try {
      await api(`/api/plushies/${revealPlushie.dataset.revealPlushie}/reveal`, 'POST');
    } catch (err) { mdui.snackbar({ message: err.message }); }
    return;
  }
  if (simulateMerge) {
    try {
      await api(`/api/merges/${simulateMerge.dataset.simulateMerge}/simulate`, 'POST');
    } catch (err) { mdui.snackbar({ message: err.message }); }
    return;
  }
  if (replayEvent) {
    try {
      const event = JSON.parse(decodeURIComponent(replayEvent.dataset.replayEvent));
      await api('/api/events/replay', 'POST', event);
    } catch (err) { mdui.snackbar({ message: err.message }); }
    return;
  }
  if (detailEvent) {
    $('event-raw').textContent = prettyJson(decodeURIComponent(detailEvent.dataset.detailEvent));
    $('event-dialog').open = true;
    return;
  }
  if (editMerge) {
    const m = state.merges.find((x) => x.id === editMerge.dataset.editMerge);
    if (!m) return;
    const soundSelect = $('merge-sound');
    if (m.sound && !state.sounds.includes(m.sound)) {
      soundSelect.insertAdjacentHTML('beforeend',
        `<mdui-menu-item value="${escapeHtml(m.sound)}">${escapeHtml(m.sound)}</mdui-menu-item>`);
    }
    $('merge-source').value = m.sourceRarity;
    $('merge-count').value = String(m.count);
    $('merge-bonus').value = String(m.bonusWeight);
    soundSelect.value = m.sound || '';
    $('merge-superior').checked = !!m.superiorOnly;
    editingMerge = m.id;
    $('merge-submit').textContent = 'Update merge';
    return;
  }
  if (delMerge) {
    try {
      await mdui.confirm({
        headline: 'Delete merge?',
        description: 'This removes the merge recipe.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
      });
    } catch { return; }
    try {
      await api(`/api/merges/${delMerge.dataset.delMerge}`, 'DELETE');
      await loadState();
    } catch (err) { mdui.snackbar({ message: err.message }); }
  }
});

function cancelRarityEdit() {
  editingRarity = null;
  $('rarity-name').value = '';
  $('rarity-weight').value = '';
  $('rarity-color').value = '#9ca3af';
  $('rarity-sound').value = '';
  $('rarity-submit').textContent = 'Add rarity';
}

function cancelMergeEdit() {
  editingMerge = null;
  $('merge-source').value = '';
  $('merge-count').value = '';
  $('merge-bonus').value = '';
  $('merge-sound').value = '';
  $('merge-superior').checked = false;
  $('merge-submit').textContent = 'Add merge';
}

// ---- Socket connection status -------------------------------------------

const socket = io();
const connectionEl = $('connection');

socket.on('connect', () => {
  connectionEl.textContent = 'Connected';
  connectionEl.className = 'connection on';
});
socket.on('disconnect', () => {
  connectionEl.textContent = 'Disconnected';
  connectionEl.className = 'connection off';
});
socket.on('state', (s) => {
  Object.assign(state, s);
  renderAll();
});

loadState();

// ---- Navigation ----------------------------------------------------------

const SECTIONS = ['settings', 'rarities', 'plushies', 'merges', 'events'];

function showSection(name) {
  SECTIONS.forEach((n) => {
    document.getElementById(`section-${n}`).hidden = (n !== name);
    document.getElementById(`nav-${n}`).active = (n === name);
  });
  if (name === 'events') loadEvents();
}

SECTIONS.forEach((name) => {
  document.getElementById(`nav-${name}`).addEventListener('click', () => showSection(name));
});

// ---- Events --------------------------------------------------------------

function eventIcon(type) {
  switch (type) {
    case 'roll': return 'casino';
    case 'merge': return 'auto_awesome';
    case 'merge-request': return 'swap_horiz';
    case 'merge-deny': return 'block';
    default: return 'info';
  }
}

function eventColor(e) {
  if (e.rarity && e.rarity.color) return e.rarity.color;
  if (e.source && e.source.color) return e.source.color;
  return '#9aa3b2';
}

function rarityChip(r) {
  if (!r) return '<span style="color:#888">unknown</span>';
  return `<span style="color:${escapeHtml(r.color)}">${escapeHtml(r.name)}</span>`;
}

function eventSummary(e) {
  switch (e.type) {
    case 'roll': {
      const p = e.plushie ? escapeHtml(e.plushie.name) : 'Unknown';
      return `rolled <b>${p}</b> (${rarityChip(e.rarity)})`;
    }
    case 'merge': {
      const p = e.plushie ? escapeHtml(e.plushie.name) : 'Unknown';
      return `fused ${e.count}× ${rarityChip(e.source)} → <b>${p}</b> (${rarityChip(e.rarity)})`;
    }
    case 'merge-request':
      return `requested a fusion (${e.count}× ${rarityChip(e.source)})`;
    case 'merge-deny':
      return `fusion denied — ${escapeHtml(e.reason || 'unknown reason')}`;
    default:
      return escapeHtml(e.type || 'event');
  }
}

function renderEvents(events) {
  const list = $('events-list');
  if (!events || events.length === 0) {
    list.innerHTML = emptyItem('No events yet. Rolls and fusions will appear here.');
    return;
  }
  list.innerHTML = events.map((e) => {
    const time = new Date(e.ts).toLocaleString();
    const payload = encodeURIComponent(JSON.stringify(e));
    const raw = encodeURIComponent(e.raw || JSON.stringify(e));
    return `
      <mdui-list-item nonclickable>
        <div slot="custom" class="row">
          <mdui-icon name="${eventIcon(e.type)}" style="color:${eventColor(e)}"></mdui-icon>
          <div class="row-meta">
            <div class="row-title">${eventSummary(e)}</div>
            <div class="row-sub">${escapeHtml(e.viewer || '')} · ${escapeHtml(time)}</div>
          </div>
          <mdui-button-icon icon="replay" data-replay-event="${payload}"></mdui-button-icon>
          <mdui-button-icon icon="code" data-detail-event="${raw}"></mdui-button-icon>
        </div>
      </mdui-list-item>
    `;
  }).join('');
}

async function loadEvents() {
  try {
    const data = await api('/api/events');
    renderEvents(data.events);
  } catch (err) { mdui.snackbar({ message: err.message }); }
}

function prettyJson(str) {
  try { return JSON.stringify(JSON.parse(str), null, 2); }
  catch { return str; }
}

$('events-refresh').addEventListener('click', () => loadEvents());
$('event-close').addEventListener('click', () => { $('event-dialog').open = false; });
