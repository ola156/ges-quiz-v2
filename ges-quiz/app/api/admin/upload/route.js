import { NextResponse } from 'next/server';
import { db } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/admin';

const MAX_BYTES = 1024 * 1024; // the browser already shrinks to ~300 KB; this is a safety cap
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const FOLDERS = ['questions', 'creators'];

// Takes one already-resized image and returns its public address in the 'quiz-images' bucket.
export async function POST(req) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  const form = await req.formData();
  const file = form.get('file');
  const folder = FOLDERS.includes(form.get('folder')) ? form.get('folder') : 'questions';
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'No file' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: 'Use a JPG, PNG or WebP image' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image is too large' }, { status: 400 });

  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const supabase = db();
  const { error } = await supabase.storage
    .from('quiz-images')
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, cacheControl: '31536000' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data } = supabase.storage.from('quiz-images').getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
