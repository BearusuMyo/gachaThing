import tmi from 'tmi.js';

export function startTwitch({ channel, username, token, onCommand, onLog }) {
  if (!channel || !username || !token) {
    onLog('Twitch not configured — chat disabled. Set TWITCH_CHANNEL, TWITCH_BOT_USERNAME and TWITCH_OAUTH_TOKEN in .env.');
    return null;
  }

  const client = new tmi.Client({
    options: { debug: false },
    connection: { reconnect: true, secure: true },
    identity: { username, password: token },
    channels: [channel],
  });

  client.on('connected', () => onLog(`Connected to #${channel} as ${username}`));
  client.on('disconnected', (reason) => onLog(`Disconnected from Twitch: ${reason}`));

  client.on('message', (target, context, msg, self) => {
    if (self) return;
    const text = msg.trim();
    if (!text.startsWith('!')) return;
    const [rawCommand, ...args] = text.slice(1).split(/\s+/);
    onCommand({
      command: rawCommand.toLowerCase(),
      args,
      viewer: context.username,
      displayName: context['display-name'] || context.username,
      userId: context['user-id'],
    });
  });

  client.connect().catch((err) => onLog(`Twitch connect error: ${err.message}`));
  return client;
}
