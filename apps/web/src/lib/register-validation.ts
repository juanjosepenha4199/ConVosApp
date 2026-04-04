const CONSUMER_EMAIL_RE = /^[^\s@]+@(gmail\.com|outlook\.com|yahoo\.com)$/i;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isConsumerEmail(email: string) {
  return CONSUMER_EMAIL_RE.test(normalizeEmail(email));
}

export const CONSUMER_EMAIL_HINT =
  'Solo Gmail, Outlook o Yahoo (ej. nombre@gmail.com).';
