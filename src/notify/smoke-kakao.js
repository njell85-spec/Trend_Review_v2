import dotenv from 'dotenv';
import { sendKakao } from './kakao.js';
import { buildSmokeReport } from './smoke-report.js';

dotenv.config();

const result = await sendKakao({ report: buildSmokeReport() });

console.log(JSON.stringify(result, null, 2));

if (result.status !== 'sent') {
  console.log(
    'Set KAKAO_REST_API_KEY and KAKAO_REFRESH_TOKEN, or KAKAO_ACCESS_TOKEN, then run npm run notify:test:kakao again.',
  );
}
