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

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

app.get('/', (req, res) => res.redirect(config.admin ? '/admin' : '/gacha'));
app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
app.get('/gacha', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'gacha.html')));

function publicState() {
  const { rarities, plushies } = store.getPlushiesData();
  return { rarities, plushies, settings: store.getSettings(), images: listImages(), sounds: listSounds() };
}

function broadcastState() {
  io.emit('state', publicState());
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

// ---- Gacha engine -------------------------------------------------------

let twitchClient = null;
const lastRollAt = new Map();

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
        count,
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    viewer,
    displayName,
    total: entries.reduce((sum, e) => sum + e.count, 0),
    unique: entries.length,
    entries,
  };
}

function handleCommand({ command, viewer, displayName }) {
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
    emitReveal({ viewer, displayName, ...result });
  } else if (command === settings.commands.collection) {
    io.emit('collection:show', buildCollectionData(viewer, displayName));
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
});

server.listen(config.port, () => {
  const mode = config.admin ? 'admin' : 'gacha';
  console.log(`Gacha Thing running: http://localhost:${config.port} (mode: ${mode})`);
  console.log(`Admin page:   http://localhost:${config.port}/admin`);
  console.log(`Gacha overlay: http://localhost:${config.port}/gacha`);
});
