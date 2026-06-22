import { sendKakao } from './kakao.js';
import { sendTelegram } from './telegram.js';

export async function notify({ report, config, options }) {
  if (options.noNotify) {
    return [{ provider: 'all', status: 'skipped', reason: '--no-notify' }];
  }

  const notificationConfig = config.delivery.notifications ?? {};
  const order = notificationConfig.order ?? ['kakao', 'telegram'];
  const mode = options.notifyMode || notificationConfig.mode || 'first-success';
  const results = [];

  for (const provider of order) {
    const providerConfig = notificationConfig[provider] ?? {};
    if (providerConfig.enabled === false) {
      results.push({ provider, status: 'skipped', reason: 'disabled' });
      continue;
    }

    try {
      const result = provider === 'kakao'
        ? await sendKakao({ report, config, options })
        : provider === 'telegram'
          ? await sendTelegram({ report, config, options })
          : { provider, status: 'skipped', reason: 'unknown provider' };

      results.push(result);
      if (mode === 'first-success' && result.status === 'sent') break;
    } catch (error) {
      results.push({
        provider,
        status: 'failed',
        reason: error.message,
      });
    }
  }

  return results;
}
