# 🧸 Gacha Thing

A self-hosted Twitch chat gacha machine. Viewers type a command in chat to "pull"
a random plushie, which is revealed on a stream overlay (with sound) and added to
their persistent collection. Viewers can also **fuse** several plushies of a tier
for a boosted chance at rarer tiers. The streamer manages everything — rarities,
plushies, sounds, fusion recipes — through an admin page.

## Features

- Watches Twitch chat for configurable commands (`!gacha`, `!plushies`, `!merge`,
  `!confirm` by default).
- Weighted rarity system — each rarity has a numeric weight, so pull chances are
  fully configurable.
- Plushie catalog with **name**, **rarity**, **description**, **series**,
  **artist**, and an **image** (auto-detected from a folder).
- Per-rarity **sounds** played on reveal, plus a separate **fusion sound**.
- **Fusion (merge)**: sacrifice N plushies of a tier to boost the chance of
  superior tiers (optionally *superior-only*), with a dedicated fusion animation.
- On-screen **collection** viewer (grid of cards with auto-scroll), shown via the
  `!plushies` command.
- Configurable reveal style: centered **card** or corner **notification**.
- An **events** log (JSONL audit trail) with replay from the admin page.
- A disconnect banner on the overlay when the app or Twitch connection drops.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file (copy `.env.example`):

   ```bash
   cp .env.example .env
   ```

3. Fill in your credentials:

   - `TWITCH_CHANNEL` — the channel to join (the streamer's channel, lowercase).
   - `TWITCH_BOT_USERNAME` — the account the bot uses (can be your own account).
   - `TWITCH_OAUTH_TOKEN` — see [Getting a token](#getting-a-token) below.

### Getting a token

Twitch chat (IRC) needs an OAuth access token for the bot account, with the
`chat:read` and `chat:edit` scopes. The old `twitchapps.com/tmi` generator is
discontinued — use the official flow instead:

1. Register an application at <https://dev.twitch.tv/console/apps> to get a
   **Client ID** (a Client Secret is *not* needed for the chat scopes). Set a
   redirect URI of `http://localhost`.

2. Open this URL in your browser (substituting your Client ID):

   ```
   https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost&scope=chat:read+chat:edit
   ```

3. Authorize, then copy the `access_token` value from the `#` fragment of the
   URL you land on, and put it in `.env` prefixed with `oauth:`.

   ```
   TWITCH_OAUTH_TOKEN=oauth:<access_token>
   ```

Alternatively, the [Twitch CLI](https://dev.twitch.tv/docs/cli/) can generate one:

```bash
twitch token -u -s "chat:read chat:edit"
```

4. Run:

   ```bash
   # Gacha overlay as the landing page (default)
   npm start

   # Admin config page as the landing page
   npm run admin
   ```

   Or double-click `start.bat` (Windows) for a one-click start — it checks for
   Node, installs dependencies on first run, then runs the server. Press
   `Ctrl+C` in that window to stop safely (or use `stop.bat` as a hard-stop
   fallback).

## Pages

- **Admin (config):** `http://localhost:3000/admin` — a navigation drawer with
  sections for **Settings** (commands, cooldown, reveal/collection style),
  **Rarities** (name/weight/color/sound), **Plushies** (add via a FAB + dialog),
  **Merges** (fusion recipes), and **Events** (audit log with replay).
- **Gacha overlay:** `http://localhost:3000/gacha` — add this as a browser
  source in OBS. It's transparent and hidden until a viewer rolls, and shows a
  banner if the app/Twitch connection drops.

The `--admin` flag only changes which page the root URL `/` redirects to; both
pages are always available at their own paths.

## Adding plushies

Plushies are image-based. Drop an image file into `public/plushies/` and the app
will automatically create a plushie entry for it:

1. Put the image in `public/plushies/` (`png`, `jpg`, `jpeg`, `gif`, `webp`,
   `svg`, `avif`, or `bmp`).
2. The app watches the folder (and rescans on start) and creates a plushie whose
   name is derived from the file name (e.g. `cocoa-bunny.png` → "Cocoa Bunny").
3. Open the admin page to set its rarity, description, series, and artist.

You can also click "Rescan images" on the admin page to pick up new files
immediately.

## Sounds

Drop sound files into `public/sounds/` (`mp3`, `wav`, `ogg`, `m4a`, `aac`,
`flac`, `opus`, `weba`). In the admin you can:

- assign a sound to each **rarity** (played when that rarity is revealed), and
- assign a **fusion sound** per merge recipe (played before the fusion animation).

Note: browsers/OBS block unmuted autoplay until a user gesture. For OBS, launch
it with `--autoplay-policy=no-user-gesture-required` (or interact with the
browser source once) so sounds play on stream.

## Fusion (merge)

In the **Merges** admin section, define recipes: a source tier, how many plushies
to sacrifice (`count`), a `bonusWeight` added to every **superior** tier (a tier
with a lower weight), an optional fusion sound, and a "superior tiers only"
toggle (which excludes the source and lower tiers entirely).

- `!merge <tier>` — checks the viewer owns enough plushies, then asks to confirm.
- `!confirm` — re-checks, then sacrifices the plushies and rolls immediately
  with the boosted weights, revealing the result on the overlay.

## How it works

1. A viewer types `!gacha` in chat.
2. The bot picks a rarity weighted by its configured weight, then a random
   plushie within that rarity.
3. The plushie is added to the viewer's collection and the reveal is pushed to
   the overlay over Socket.IO (playing the rarity's sound).
4. The overlay animates the reveal, then hides again after the configured duration.

`!plushies` shows a viewer's collection on the overlay (a grid that auto-scrolls
when it overflows). A viewer can also `!merge` a tier (then `!confirm`) to
sacrifice plushies for a boosted roll — a separate fusion animation plays first
(the sacrificed plushies converge, then the result bursts in).

Every roll and merge is written to an append-only log, viewable (and replayable)
from the admin **Events** page.

## Data storage

Everything lives in `data/` (gitignored):

- `plushies.json` — rarity tiers and the plushie catalog.
- `collections.json` — per-viewer collections.
- `settings.json` — commands, cooldown, reveal duration, styles.
- `merges.json` — fusion recipes.
- `events.jsonl` — append-only audit log (rotates to `events.YYYYMMDD.jsonl`).

Plushie images live in `public/plushies/` (`/plushies/<file>`) and sounds in
`public/sounds/` (`/sounds/<file>`).
