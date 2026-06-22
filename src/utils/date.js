export function todayKst() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function pubmedDateRange(days, endDate = null) {
  const end = endDate ? new Date(`${endDate}T00:00:00Z`) : new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Number(days));
  return {
    minDate: formatPubmedDate(start),
    maxDate: formatPubmedDate(end),
  };
}

export function formatPubmedDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

export function isoNow() {
  return new Date().toISOString();
}

