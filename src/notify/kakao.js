import { buildMobileSummaryMessage } from './message.js';
import { fetchWithRetry } from '../utils/http.js';

export async function sendKakao({ report }) {
  const token = await getKakaoAccessToken();
  if (!token.accessToken) {
    return {
      provider: 'kakao',
      status: 'skipped',
      reason: token.reason,
      preview: buildKakaoTemplateObject(report),
    };
  }

  const templateObject = buildKakaoTemplateObject(report);
  const body = new URLSearchParams({
    template_object: JSON.stringify(templateObject),
  });

  const response = await fetchWithRetry('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body,
  });
  const result = await response.json().catch(() => ({}));
  if (result.result_code !== undefined && result.result_code !== 0) {
    return {
      provider: 'kakao',
      status: 'failed',
      reason: `Kakao result_code ${result.result_code}`,
      accessTokenRefreshed: token.source === 'refresh_token',
      refreshTokenRotated: token.refreshTokenRotated,
    };
  }

  return {
    provider: 'kakao',
    status: 'sent',
    resultCode: result.result_code ?? null,
    accessTokenRefreshed: token.source === 'refresh_token',
    refreshTokenRotated: token.refreshTokenRotated,
  };
}

export function buildKakaoTemplateObject(report) {
  const dashboardUrl = fullDashboardUrl(report.dashboardUrl);
  return {
    object_type: 'text',
    text: buildKakaoText(report),
    link: {
      web_url: dashboardUrl,
      mobile_web_url: dashboardUrl,
    },
    button_title: '리포트 보기',
  };
}

function buildKakaoText(report) {
  const lines = buildMobileSummaryMessage(report)
    .split('\n')
    .filter((line) => line && !line.startsWith('전체 리포트:'));
  return truncate(lines.join('\n'), 200);
}

async function getKakaoAccessToken() {
  if (process.env.KAKAO_REFRESH_TOKEN && process.env.KAKAO_REST_API_KEY) {
    return refreshKakaoAccessToken();
  }

  if (process.env.KAKAO_ACCESS_TOKEN) {
    return {
      accessToken: process.env.KAKAO_ACCESS_TOKEN,
      source: 'access_token',
      refreshTokenRotated: false,
    };
  }

  return {
    accessToken: '',
    source: 'none',
    refreshTokenRotated: false,
    reason: 'KAKAO_REFRESH_TOKEN and KAKAO_REST_API_KEY, or KAKAO_ACCESS_TOKEN, are missing',
  };
}

async function refreshKakaoAccessToken() {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.KAKAO_REST_API_KEY,
    refresh_token: process.env.KAKAO_REFRESH_TOKEN,
  });

  if (process.env.KAKAO_CLIENT_SECRET) {
    body.set('client_secret', process.env.KAKAO_CLIENT_SECRET);
  }

  const response = await fetchWithRetry('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body,
  });
  const token = await response.json();
  if (!token.access_token) {
    throw new Error('Kakao refresh token response did not include access_token');
  }

  return {
    accessToken: token.access_token,
    source: 'refresh_token',
    expiresIn: token.expires_in,
    refreshTokenRotated: Boolean(token.refresh_token),
    refreshTokenExpiresIn: token.refresh_token_expires_in,
  };
}

function fullDashboardUrl(url) {
  const value = String(url || process.env.DASHBOARD_URL || 'https://example.com/').trim();
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}
