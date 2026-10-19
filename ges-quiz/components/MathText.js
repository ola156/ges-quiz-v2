import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Plain, splitMath } from './MathParts';

// Server version of Rich: the maths is drawn on the server, so titles and headings arrive
// already formatted, with no flash of raw $...$ and no extra JavaScript sent to the phone.
export default function MathText({ text }) {
  return splitMath(text).map((p, i) => {
    if (p.t !== 'math') return <Plain key={i} text={p.v} />;
    let html;
    try { html = katex.renderToString(p.v, { throwOnError: false }); } catch { return <span key={i}>{p.v}</span>; }
    return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
  });
}