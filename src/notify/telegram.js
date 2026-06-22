import { fetchWithRetry } from '../utils/http.js';
import { buildMobileSummaryMessage } from './message.js';

export async function sendTelegram({ report }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return {
      provider: 'telegram',
      status: 'skipped',
      reason: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing',
    };
  }

  const message = buildMobileSummaryMessage(report);
  await fetchWithRetry(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      disable_web_page_preview: false,
    }),
  });

  return {
    provider: 'telegram',
    status: 'sent',
  };
}
