import 'dotenv/config';

function parseArgs(argv) {
  return {
    admin: argv.includes('--admin'),
  };
}

export function loadConfig() {
  const args = parseArgs(process.argv.slice(2));
  const token = (process.env.TWITCH_OAUTH_TOKEN || '').trim();
  return {
    admin: args.admin,
    port: Number(process.env.PORT) || 3000,
    channel: (process.env.TWITCH_CHANNEL || '').trim().toLowerCase(),
    botUsername: (process.env.TWITCH_BOT_USERNAME || '').trim().toLowerCase(),
    oauthToken: token.startsWith('oauth:') ? token : token ? `oauth:${token}` : '',
  };
}
