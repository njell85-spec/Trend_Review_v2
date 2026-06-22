import dotenv from 'dotenv';
import { sendTelegram } from './telegram.js';
import { buildSmokeReport } from './smoke-report.js';

dotenv.config();

const result = await sendTelegram({ report: buildSmokeReport() });

console.log(JSON.stringify(result, null, 2));

if (result.status !== 'sent') {
  console.log(
    'Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env or GitHub Secrets, then run npm run notify:test again.',
  );
}
