import { NextResponse } from 'next/server';
import { db } from '../../../lib/supabase';
import { hashPin, PIN_RE, UUID_RE } from '../../../lib/pin';

const bad = (msg, status = 400, extra = {}) => NextResponse.json({ error: msg, ...extra }, { status });

// Sets a PIN on the profile that belongs to this device. A PIN can only be set once here,
// so nobody can overwrite an existing one.
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return bad('Bad request'); }
  const clientId = typeof body.clientId === 'string' ? body.clientId.trim().toLowerCase() : '';
  const pin = String(body.pin || '').trim();
  if (!UUID_RE.test(clientId)) return bad('Invalid session. Reload the page and try again.');
  if (!PIN_RE.test(pin)) return bad('PIN must be exactly 4 digits.');

  const supabase = db();
  const { data: me } = await supabase
    .from('profiles').select('client_id, pin_hash').eq('client_id', clientId).maybeSingle();
  if (!me) return bad('Finish one quiz first, then you can set a PIN.', 404);
  if (me.pin_hash) return bad('A PIN is already set for this username.', 409, { already: true });

  const { error } = await supabase
    .from('profiles')
    .update({ pin_hash: hashPin(pin), pin_fails: 0, pin_locked_until: null })
    .eq('client_id', clientId)
    .is('pin_hash', null);
  if (error) return bad('Could not save your PIN. Try again.', 500);
  return NextResponse.json({ ok: true });
}