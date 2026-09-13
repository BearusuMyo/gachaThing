import express from 'express';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

import { loadConfig } from './config.js';
import * as store from './store.js';
import { rollPlushie } from './gacha.js';
import { startTwitch } from './twitch.js';
import { listImages, listSounds, syncPlushiesFromImages, watchPlushiesDir } from './scanner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const config = loadConfig();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let twitchConnected = false;
const twitchConfigured = !!(config.channel && config.botUsername && config.oauthToken);

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

app.get('/', (req, res) => res.redirect(config.admin ? '/admin' : '/gacha'));
app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
app.get('/gacha', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'gacha.html')));

function publicState() {
  const { rarities, plushies } = store.getPlushiesData();
  return { rarities, plushies, settings: store.getSettings(), merges: store.getMerges(), images: listImages(), sounds: listSounds(), twitchConnected, twitchConfigured };
}

function broadcastState() {
  io.emit('state', publicState());
}

function broadcastStatus() {
  io.emit('status', { twitchConnected });
}

// ---- REST API -----------------------------------------------------------

app.get('/api/state', (req, res) => res.json(publicState()));

app.get('/api/collections', (req, res) => res.json(store.getCollections()));

// Rarities
app.post('/api/rarities', (req, res) => {
  const { name, weight, color, sound } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const data = store.getPlushiesData();
  const rarity = { id: crypto.randomUUID(), name, weight: Number(weight) || 0, color: color || '#888888', sound: sound || null };
  data.rarities.push(rarity);
  store.savePlushies(data);
  broadcastState();
  res.json(rarity);
});

app.put('/api/rarities/:id', (req, res) => {
  const data = store.getPlushiesData();
  const rarity = data.rarities.find((r) => r.id === req.params.id);
  if (!rarity) return res.status(404).json({ error: 'rarity not found' });
  const { name, weight, color, sound } = req.body || {};
  if (name !== undefined) rarity.name = name;
  if (weight !== undefined) rarity.weight = Number(weight) || 0;
  if (color !== undefined) rarity.color = color;
  if (sound !== undefined) rarity.sound = sound || null;
  store.savePlushies(data);
  broadcastState();
  res.json(rarity);
});

app.delete('/api/rarities/:id', (req, res) => {
  const data = store.getPlushiesData();
  const idx = data.rarities.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'rarity not found' });
  const [removed] = data.rarities.splice(idx, 1);
  data.plushies.forEach((p) => {
    if (p.rarity === removed.id) p.rarity = null;
  });
  store.savePlushies(data);
  broadcastState();
  res.json({ ok: true });
});

// Plushies
app.post('/api/plushies', (req, res) => {
  const { name, rarity, description, series, artist, image } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const data = store.getPlushiesData();
  const plushie = {
    id: crypto.randomUUID(),
    name,
    rarity: rarity || null,
    description: description || '',
    series: series || '',
    artist: artist || '',
    image: image || null,
  };
  data.plushies.push(plushie);
  store.savePlushies(data);
  broadcastState();
  res.json(plushie);
});

app.put('/api/plushies/:id', (req, res) => {
  const data = store.getPlushiesData();
  const plushie = data.plushies.find((p) => p.id === req.params.id);
  if (!plushie) return res.status(404).json({ error: 'plushie not found' });
  const { name, rarity, description, series, artist, image } = req.body || {};
  if (name !== undefined) plushie.name = name;
  if (rarity !== undefined) plushie.rarity = rarity || null;
  if (description !== undefined) plushie.description = description;
  if (series !== undefined) plushie.series = series;
  if (artist !== undefined) plushie.artist = artist || '';
  if (image !== undefined) plushie.image = image || null;
  store.savePlushies(data);
  broadcastState();
  res.json(plushie);
});

app.delete('/api/plushies/:id', (req, res) => {
  const data = store.getPlushiesData();
  const idx = data.plushies.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'plushie not found' });
  data.plushies.splice(idx, 1);
  store.savePlushies(data);
  broadcastState();
  res.json({ ok: true });
});

// Preview a specific plushie on the overlay (does not persist to any collection)
app.post('/api/plushies/:id/reveal', (req, res) => {
  const data = store.getPlushiesData();
  const plushie = data.plushies.find((p) => p.id === req.params.id);
  if (!plushie) return res.status(404).json({ error: 'plushie not found' });
  const rarity = data.rarities.find((r) => r.id === plushie.rarity) || null;
  emitReveal({ viewer: 'preview', displayName: 'Preview', plushie, rarity });
  res.json({ ok: true });
});

// Settings
app.put('/api/settings', (req, res) => {
  const settings = store.getSettings();
  const { commands, cooldownSeconds, revealDurationMs, revealStyle, collectionStyle } = req.body || {};
  if (commands) settings.commands = { ...settings.commands, ...commands };
  if (cooldownSeconds !== undefined) settings.cooldownSeconds = Number(cooldownSeconds) || 0;
  if (revealDurationMs !== undefined) settings.revealDurationMs = Number(revealDurationMs) || 0;
  if (revealStyle !== undefined) settings.revealStyle = revealStyle === 'notification' ? 'notification' : 'card';
  if (collectionStyle !== undefined) settings.collectionStyle = collectionStyle === 'notification' ? 'notification' : 'card';
  store.saveSettings(settings);
  broadcastState();
  res.json(settings);
});

// Test roll (does not persist to any collection)
app.post('/api/test-roll', (req, res) => {
  const result = rollPlushie(store.getPlushiesData());
  if (!result) return res.status(400).json({ error: 'No plushies available' });
  emitReveal({ viewer: 'test', displayName: 'Test Roll', ...result });
  res.json(result);
});

// Rescan the plushie images folder and create entries for any new files
app.post('/api/rescan', (req, res) => {
  const changed = syncPlushiesFromImages();
  if (changed) broadcastState();
  res.json({ ok: true, changed, images: listImages() });
});

// Merges
app.get('/api/merges', (req, res) => res.json(store.getMerges()));

app.post('/api/merges', (req, res) => {
  const { sourceRarity, count, bonusWeight, sound, superiorOnly } = req.body || {};
  if (!sourceRarity) return res.status(400).json({ error: 'sourceRarity is required' });
  const merges = store.getMerges();
  const recipe = {
    id: crypto.randomUUID(),
    sourceRarity,
    count: Number(count) || 0,
    bonusWeight: Number(bonusWeight) || 0,
    sound: sound || null,
    superiorOnly: !!superiorOnly,
  };
  merges.push(recipe);
  store.saveMerges(merges);
  broadcastState();
  res.json(recipe);
});

app.put('/api/merges/:id', (req, res) => {
  const merges = store.getMerges();
  const recipe = merges.find((m) => m.id === req.params.id);
  if (!recipe) return res.status(404).json({ error: 'merge not found' });
  const { sourceRarity, count, bonusWeight, sound, superiorOnly } = req.body || {};
  if (sourceRarity !== undefined) recipe.sourceRarity = sourceRarity;
  if (count !== undefined) recipe.count = Number(count) || 0;
  if (bonusWeight !== undefined) recipe.bonusWeight = Number(bonusWeight) || 0;
  if (sound !== undefined) recipe.sound = sound || null;
  if (superiorOnly !== undefined) recipe.superiorOnly = !!superiorOnly;
  store.saveMerges(merges);
  broadcastState();
  res.json(recipe);
});

app.delete('/api/merges/:id', (req, res) => {
  const merges = store.getMerges();
  const idx = merges.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'merge not found' });
  merges.splice(idx, 1);
  store.saveMerges(merges);
  broadcastState();
  res.json({ ok: true });
});

// Simulate a fusion on the overlay (boosted roll, does not persist anything)
app.post('/api/merges/:id/simulate', (req, res) => {
  const merges = store.getMerges();
  const recipe = merges.find((m) => m.id === req.params.id);
  if (!recipe) return res.status(404).json({ error: 'merge not found' });

  const data = store.getPlushiesData();
  const source = data.rarities.find((r) => r.id === recipe.sourceRarity);
  if (!source) return res.status(400).json({ error: 'source rarity not found' });

  const result = rollPlushie(data, { sourceWeight: Number(source.weight), bonusWeight: Number(recipe.bonusWeight), superiorOnly: !!recipe.superiorOnly });
  if (!result) return res.status(400).json({ error: 'No plushies available' });

  const sacrificed = data.plushies
    .filter((p) => p.rarity === recipe.sourceRarity)
    .slice(0, Math.min(recipe.count, 6))
    .map((p) => ({ id: p.id, name: p.name, image: p.image, count: 1 }));

  emitReveal({ viewer: 'simulation', displayName: 'Fusion Sim', ...result, merged: true, sacrificed, mergeSound: recipe.sound });
  res.json(result);
});

// ---- Gacha engine -------------------------------------------------------

let twitchClient = null;
const lastRollAt = new Map();
const pendingMerges = new Map();

function emitReveal(payload) {
  io.emit('gacha:reveal', payload);
}

function addToCollection(viewer, plushieId) {
  const collections = store.getCollections();
  if (!collections[viewer]) collections[viewer] = {};
  collections[viewer][plushieId] = (collections[viewer][plushieId] || 0) + 1;
  store.saveCollections(collections);
}

function buildCollectionData(viewer, displayName) {
  const collections = store.getCollections();
  const { rarities, plushies } = store.getPlushiesData();
  const mine = collections[viewer] || {};
  const entries = Object.entries(mine)
    .map(([id, count]) => {
      const p = plushies.find((x) => x.id === id);
      const rarity = p ? rarities.find((r) => r.id === p.rarity) : null;
      return {
        id,
        name: p ? p.name : 'Unknown',
        image: p ? p.image : null,
        rarityName: rarity ? rarity.name : null,
        rarityColor: rarity ? rarity.color : '#888888',
        rarityWeight: rarity ? Number(rarity.weight) : null,
        count,
      };
    })
    .sort((a, b) =>
      (a.rarityWeight ?? Infinity) - (b.rarityWeight ?? Infinity) ||
      b.count - a.count ||
      a.name.localeCompare(b.name)
    );

  return {
    viewer,
    displayName,
    total: entries.reduce((sum, e) => sum + e.count, 0),
    unique: entries.length,
    entries,
  };
}

function plushieIdsOfRarity(data, rarityId) {
  return new Set(data.plushies.filter((p) => p.rarity === rarityId).map((p) => p.id));
}

function countOfRarity(collections, viewer, data, rarityId) {
  const mine = collections[viewer] || {};
  const ids = plushieIdsOfRarity(data, rarityId);
  let total = 0;
  for (const [id, n] of Object.entries(mine)) {
    if (ids.has(id)) total += n;
  }
  return total;
}

function takePlushiesOfRarity(mine, data, rarityId, count) {
  const ids = plushieIdsOfRarity(data, rarityId);
  const sacrificed = [];
  let remaining = count;
  for (const id of Object.keys(mine)) {
    if (remaining <= 0) break;
    if (!ids.has(id)) continue;
    const take = Math.min(mine[id], remaining);
    mine[id] -= take;
    if (mine[id] <= 0) delete mine[id];
    remaining -= take;
    const p = data.plushies.find((x) => x.id === id);
    sacrificed.push({ id, name: p ? p.name : 'Unknown', image: p ? p.image : null, count: take });
  }
  return sacrificed;
}

function handleMerge(viewer, displayName, args) {
  const settings = store.getSettings();
  const merges = store.getMerges();
  const data = store.getPlushiesData();
  const collections = store.getCollections();

  const tierName = (args[0] || '').toLowerCase();
  const rarity = data.rarities.find((r) => r.name.toLowerCase() === tierName);

  if (!rarity) {
    const available = merges
      .map((m) => data.rarities.find((r) => r.id === m.sourceRarity))
      .filter(Boolean)
      .map((r) => r.name);
    twitchClient?.say(config.channel, available.length
      ? `@${displayName}, merge which tier? Available: ${available.join(', ')}.`
      : `@${displayName}, no merge tiers are configured yet.`);
    return;
  }

  const recipe = merges.find((m) => m.sourceRarity === rarity.id);
  if (!recipe) {
    twitchClient?.say(config.channel, `@${displayName}, merging isn't configured for ${rarity.name}.`);
    return;
  }

  const owned = countOfRarity(collections, viewer, data, rarity.id);
  if (owned < recipe.count) {
    twitchClient?.say(config.channel, `@${displayName}, you need ${recipe.count}× ${rarity.name} to merge, but you have ${owned}.`);
    store.appendEvent({ type: 'merge-deny', viewer, source: rarity.id, reason: 'insufficient plushies', have: owned, need: recipe.count });
    return;
  }

  pendingMerges.set(viewer, { recipeId: recipe.id, expiresAt: Date.now() + 30000 });
  store.appendEvent({ type: 'merge-request', viewer, source: rarity.id, count: recipe.count });
  twitchClient?.say(config.channel, `@${displayName}, give up ${recipe.count}× ${rarity.name} for a boosted roll? Type !${settings.commands.confirm} within 30s.`);
}

function handleConfirm(viewer, displayName) {
  const settings = store.getSettings();
  const pending = pendingMerges.get(viewer);

  if (!pending || pending.expiresAt < Date.now()) {
    pendingMerges.delete(viewer);
    twitchClient?.say(config.channel, `@${displayName}, nothing to confirm. Type !${settings.commands.merge} <tier> first.`);
    return;
  }

  const merges = store.getMerges();
  const recipe = merges.find((m) => m.id === pending.recipeId);
  const data = store.getPlushiesData();

  if (!recipe) {
    pendingMerges.delete(viewer);
    twitchClient?.say(config.channel, `@${displayName}, that merge is no longer available.`);
    return;
  }

  const source = data.rarities.find((r) => r.id === recipe.sourceRarity);
  if (!source) {
    pendingMerges.delete(viewer);
    return;
  }

  const collections = store.getCollections();
  const mine = collections[viewer] || (collections[viewer] = {});

  // Authoritative re-check before any mutation.
  const owned = countOfRarity(collections, viewer, data, source.id);
  if (owned < recipe.count) {
    pendingMerges.delete(viewer);
    store.appendEvent({ type: 'merge-deny', viewer, source: source.id, reason: 'insufficient plushies', have: owned, need: recipe.count });
    twitchClient?.say(config.channel, `@${displayName}, you no longer have ${recipe.count}× ${source.name}.`);
    return;
  }

  const result = rollPlushie(data, { sourceWeight: Number(source.weight), bonusWeight: Number(recipe.bonusWeight), superiorOnly: !!recipe.superiorOnly });
  if (!result) {
    pendingMerges.delete(viewer);
    twitchClient?.say(config.channel, `@${displayName}, the gacha is empty! Ask the streamer to add plushies.`);
    return;
  }

  // Atomic: deduct + add result, then persist once.
  const sacrificed = takePlushiesOfRarity(mine, data, source.id, recipe.count);
  mine[result.plushie.id] = (mine[result.plushie.id] || 0) + 1;
  store.saveCollections(collections);

  pendingMerges.delete(viewer);
  store.appendEvent({ type: 'merge', viewer, source: source.id, count: recipe.count, result: result.plushie.id, resultRarity: result.rarity.id });

  emitReveal({ viewer, displayName, ...result, merged: true, sacrificed, mergeSound: recipe.sound });
  twitchClient?.say(config.channel, `@${displayName} merged ${recipe.count}× ${source.name} → ${result.plushie.name} (${result.rarity.name})!`);
}

function handleCommand({ command, args, viewer, displayName }) {
  const settings = store.getSettings();
  const data = store.getPlushiesData();

  if (command === settings.commands.gacha) {
    const now = Date.now();
    const cooldown = Number(settings.cooldownSeconds || 0) * 1000;
    const last = lastRollAt.get(viewer) || 0;
    if (cooldown > 0 && now - last < cooldown) {
      const wait = Math.ceil((cooldown - (now - last)) / 1000);
      twitchClient?.say(config.channel, `@${displayName}, wait ${wait}s before rolling again!`);
      return;
    }

    const result = rollPlushie(data);
    if (!result) {
      twitchClient?.say(config.channel, `@${displayName}, the gacha is empty! Ask the streamer to add plushies.`);
      return;
    }

    lastRollAt.set(viewer, now);
    addToCollection(viewer, result.plushie.id);
    store.appendEvent({ type: 'roll', viewer, plushie: result.plushie.id, rarity: result.rarity.id });
    emitReveal({ viewer, displayName, ...result });
  } else if (command === settings.commands.collection) {
    io.emit('collection:show', buildCollectionData(viewer, displayName));
  } else if (command === settings.commands.merge) {
    handleMerge(viewer, displayName, args || []);
  } else if (command === settings.commands.confirm) {
    handleConfirm(viewer, displayName);
  }
}

// ---- Socket.IO ----------------------------------------------------------

io.on('connection', (socket) => {
  socket.emit('state', publicState());
});

// ---- Boot ---------------------------------------------------------------

syncPlushiesFromImages();
watchPlushiesDir(() => broadcastState());

twitchClient = startTwitch({
  channel: config.channel,
  username: config.botUsername,
  token: config.oauthToken,
  onCommand: handleCommand,
  onLog: (msg) => console.log(`[twitch] ${msg}`),
  onStatus: (connected) => {
    twitchConnected = connected;
    broadcastStatus();
  },
});

server.listen(config.port, () => {
  const mode = config.admin ? 'admin' : 'gacha';
  console.log(`Gacha Thing running: http://localhost:${config.port} (mode: ${mode})`);
  console.log(`Admin page:   http://localhost:${config.port}/admin`);
  console.log(`Gacha overlay: http://localhost:${config.port}/gacha`);
  console.log('Press Ctrl+C to stop safely.');
});

function shutdown(signal) {
  console.log(`\n[app] ${signal} received — shutting down safely...`);
  if (twitchClient) {
    try { twitchClient.disconnect().catch(() => {}); } catch { /* ignore */ }
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
