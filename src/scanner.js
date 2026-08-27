import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as store from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PLUSHIES_DIR = path.join(__dirname, '..', 'public', 'plushies');
export const SOUNDS_DIR = path.join(__dirname, '..', 'public', 'sounds');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.bmp']);
const SOUND_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus', '.weba']);

export function ensureImagesDir() {
  fs.mkdirSync(PLUSHIES_DIR, { recursive: true });
}

export function ensureSoundsDir() {
  fs.mkdirSync(SOUNDS_DIR, { recursive: true });
}

export function listImages() {
  ensureImagesDir();
  let entries;
  try {
    entries = fs.readdirSync(PLUSHIES_DIR);
  } catch {
    return [];
  }
  return entries
    .filter((f) => {
      if (!IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase())) return false;
      try {
        return fs.statSync(path.join(PLUSHIES_DIR, f)).isFile();
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.localeCompare(b));
}

export function listSounds() {
  ensureSoundsDir();
  let entries;
  try {
    entries = fs.readdirSync(SOUNDS_DIR);
  } catch {
    return [];
  }
  return entries
    .filter((f) => {
      if (!SOUND_EXTENSIONS.has(path.extname(f).toLowerCase())) return false;
      try {
        return fs.statSync(path.join(SOUNDS_DIR, f)).isFile();
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.localeCompare(b));
}

function nameFromFile(filename) {
  const base = path.basename(filename, path.extname(filename));
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function syncPlushiesFromImages() {
  const images = listImages();
  const data = store.getPlushiesData();
  const known = new Set(data.plushies.map((p) => p.image));
  const defaultRarity = data.rarities[0]?.id ?? null;
  let changed = false;

  for (const image of images) {
    if (known.has(image)) continue;
    data.plushies.push({
      id: crypto.randomUUID(),
      name: nameFromFile(image),
      rarity: defaultRarity,
      description: '',
      series: '',
      artist: '',
      image,
    });
    changed = true;
  }

  if (changed) store.savePlushies(data);
  return changed;
}

export function watchPlushiesDir(onChange) {
  ensureImagesDir();
  let timer = null;
  const watcher = fs.watch(PLUSHIES_DIR, (eventType, filename) => {
    if (filename && !IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase())) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (syncPlushiesFromImages()) onChange?.();
    }, 600);
  });
  watcher.on('error', () => {});
  return watcher;
}
