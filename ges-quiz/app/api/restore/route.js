import { NextResponse } from 'next/server';
import { db } from '../../../lib/supabase';
import { checkPin, PIN_RE } from '../../../lib/pin';

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const sanitize = (u) => String(u || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
const bad = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

// Gives a device its old identity back when the username and PIN match.
// Only wrong PIN guesses count. Five wrong tries lock that one username for 15 minutes.
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return bad('Bad request'); }
  const username = sanitize(body.username);
  const pin = String(body.pin || '').trim();
  if (!username || !PIN_RE.test(pin)) return bad('Enter your username and your 4-digit PIN.');

  const supabase = db();
  const { data: p } = await supabase
    .from('profiles')
    .select('client_id, username, name, department, level, whatsapp, pin_hash, pin_fails, pin_locked_until')
    .eq('username', username)
    .maybeSingle();
  const generic = 'Wrong username or PIN, or this username has no PIN set.';
  if (!p || !p.pin_hash) return bad(generic, 401);

  if (p.pin_locked_until && new Date(p.pin_locked_until) > new Date()) {
    const mins = Math.max(1, Math.ceil((new Date(p.pin_locked_until) - new Date()) / 60000));
    return bad(`Too many wrong tries. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`, 429);
  }

  if (!checkPin(pin, p.pin_hash)) {
    const fails = (p.pin_fails || 0) + 1;
    if (fails >= MAX_FAILS) {
      await supabase.from('profiles').update({
        pin_fails: 0,
        pin_locked_until: new Date(Date.now() + LOCK_MINUTES * 60000).toISOString(),
      }).eq('client_id', p.client_id);
      return bad(`Too many wrong tries. Try again in ${LOCK_MINUTES} minutes.`, 429);
    }
    await supabase.from('profiles').update({ pin_fails: fails }).eq('client_id', p.client_id);
    const left = MAX_FAILS - fails;
    return bad(`${generic} ${left} ${left === 1 ? 'try' : 'tries'} left.`, 401);
  }

  if (p.pin_fails || p.pin_locked_until) {
    await supabase.from('profiles').update({ pin_fails: 0, pin_locked_until: null }).eq('client_id', p.client_id);
  }
  return NextResponse.json({
    clientId: p.client_id,
    profile: {
      username: p.username,
      name: p.name,
      department: p.department,
      level: p.level,
      whatsapp: p.whatsapp || '',
    },
  });
}