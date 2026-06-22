import dotenv from 'dotenv';
import { notify } from './index.js';
import { buildSmokeReport } from './smoke-report.js';

dotenv.config();

const config = {
  delivery: {
    notifications: {
      mode: 'all-enabled',
      order: ['kakao', 'telegram'],
      kakao: { enabled: true },
      telegram: { enabled: true },
    },
  },
};

const results = await notify({
  report: buildSmokeReport(),
  config,
  options: {},
});

console.log(JSON.stringify(results, null, 2));
