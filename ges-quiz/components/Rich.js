'use client';
import { useEffect, useMemo, useState } from 'react';
import 'katex/dist/katex.min.css';
import { Plain, splitMath } from './MathParts';

// Shows text with proper maths, drawn by KaTeX (loaded only when the text really has LaTeX).
// Understands $x^2$, \frac{a}{b}, \(x^2\), \[x^2\], bare \frac / \times / \sqrt, and plain x^2 or H_2O.
// Use this in client components. Server pages use MathText, which draws the maths on the server.

export { splitMath };

let katexLib = null;
let katexLoading = null;
function loadKatex() {
  if (katexLib) return Promise.resolve(katexLib);
  if (!katexLoading) katexLoading = import('katex').then((m) => (katexLib = m.default || m));
  return katexLoading;
}

function Tex({ src, katex }) {
  if (!katex) return <span>{src}</span>;
  try {
    const html = katex.renderToString(src, { throwOnError: false });
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    return <span>{src}</span>;
  }
}

export default function Rich({ text }) {
  const parts = useMemo(() => splitMath(text), [text]);
  const needsTex = parts.some((p) => p.t === 'math');
  const [katex, setKatex] = useState(katexLib);

  useEffect(() => {
    if (!needsTex || katex) return;
    let live = true;
    loadKatex().then((k) => live && setKatex(k)).catch(() => {});
    return () => { live = false; };
  }, [needsTex, katex]);

  return parts.map((p, i) =>
    p.t === 'math' ? <Tex key={i} src={p.v} katex={katex} /> : <Plain key={i} text={p.v} />,
  );
}