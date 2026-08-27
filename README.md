# 🧸 Gacha Thing

A self-hosted Twitch chat gacha machine. Viewers type a command in chat to
"pull" a random plushie, which is revealed on a stream overlay and added to
their persistent collection. The streamer manages plushies (name, rarity,
description, series, artist) through a config page.

## Features

- Watches Twitch chat for a configurable gacha command (`!gacha` by default).
- Weighted rarity system — rarities are defined by the streamer with a numeric
  weight, so pull chances are fully configurable.
- Plushie catalog with **name**, **rarity**, **description**, **series**,
  **artist**, and an **image**.
- Persistent per-viewer collections (stored in JSON files).
- A stream overlay that stays hidden until a command triggers a reveal.
- An admin page (`--admin` flag) for configuring rarities, plushies, and settings.

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

## Pages

- **Admin (config):** `http://localhost:3000/admin` — add/edit/delete rarities
  and plushies, change commands, cooldown, and reveal duration, and trigger a
  test roll.
- **Gacha overlay:** `http://localhost:3000/gacha` — add this as a browser
  source in OBS. It's transparent and hidden until a viewer rolls.

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

## How it works

1. A viewer types `!gacha` (configurable) in chat.
2. The bot picks a rarity weighted by its configured weight, then a random
   plushie within that rarity.
3. The plushie is added to the viewer's collection and the reveal is pushed to
   the overlay over Socket.IO.
4. The overlay animates the reveal, then hides again after the configured duration.

A `!plushies` (configurable) command shows a viewer's current collection in chat.

## Data storage

Plushie catalog and collections live in `data/` (gitignored):

- `plushies.json` — rarity tiers and the plushie catalog.
- `collections.json` — per-viewer collections.
- `settings.json` — commands, cooldown, and reveal duration.

Plushie images live in `public/plushies/` and are served at `/plushies/<file>`.
