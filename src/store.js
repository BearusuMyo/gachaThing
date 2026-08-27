import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const FILES = {
  plushies: 'plushies.json',
  collections: 'collections.json',
  settings: 'settings.json',
};

const defaultSettings = {
  commands: { gacha: 'gacha', collection: 'plushies' },
  cooldownSeconds: 30,
  revealDurationMs: 6000,
  revealStyle: 'card',
  collectionStyle: 'card',
};

const defaultPlushies = {
  rarities: [
    { id: 'common', name: 'Common', weight: 70, color: '#9ca3af', sound: null },
    { id: 'rare', name: 'Rare', weight: 25, color: '#3b82f6', sound: null },
    { id: 'epic', name: 'Epic', weight: 4, color: '#a855f7', sound: null },
    { id: 'legendary', name: 'Legendary', weight: 1, color: '#f59e0b', sound: null },
  ],
  plushies: [],
};

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readFile(name, fallback) {
  const filePath = path.join(DATA_DIR, name);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`[store] Failed to read ${name}: ${err.message}`);
    }
    return structuredClone(fallback);
  }
}

function writeFile(name, data) {
  ensureDir();
  const filePath = path.join(DATA_DIR, name);
  const content = JSON.stringify(data, null, 2);
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, content);
  try {
    fs.renameSync(tmp, filePath);
  } catch (err) {
    // On Windows, renaming over an existing file can fail intermittently
    // (EPERM/EEXIST). Fall back to a direct write, which overwrites reliably.
    fs.writeFileSync(filePath, content);
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

let plushiesCache = null;
let collectionsCache = null;
let settingsCache = null;

export function getPlushiesData() {
  if (!plushiesCache) {
    plushiesCache = readFile(FILES.plushies, defaultPlushies);
  }
  return plushiesCache;
}

export function savePlushies(data) {
  plushiesCache = data;
  writeFile(FILES.plushies, data);
}

export function getCollections() {
  if (!collectionsCache) {
    collectionsCache = readFile(FILES.collections, {});
  }
  return collectionsCache;
}

export function saveCollections(data) {
  collectionsCache = data;
  writeFile(FILES.collections, data);
}

export function getSettings() {
  if (!settingsCache) {
    settingsCache = readFile(FILES.settings, defaultSettings);
  }
  return settingsCache;
}

export function saveSettings(data) {
  settingsCache = data;
  writeFile(FILES.settings, data);
}
