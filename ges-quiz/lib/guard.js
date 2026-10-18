// Small helpers for the routes that act on a signed-in person.

// Browsers always send Origin on cross-site POSTs. If it is there and does not match this
// site, the request came from another website, so refuse it.
export function sameOrigin(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.get('host');
  } catch {
    return false;
  }
}

// Trims, removes control characters and limits length. Returns null when empty.
export function cleanText(v, max) {
  if (typeof v !== 'string') return null;
  const t = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return t || null;
}
