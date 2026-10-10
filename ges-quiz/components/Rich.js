'use client';
import { Fragment, useEffect, useMemo, useState } from 'react';
import 'katex/dist/katex.min.css';

// Shows question text with proper maths. It understands:
//   $x^2$   $\frac{a}{b}$   \(x^2\)   \[x^2\]      real LaTeX, drawn by KaTeX
//   \frac{1}{2}  \times  \sqrt{x}  \pi ...         bare LaTeX commands, even without dollar signs
//   x^2   10^-3   x^{n+1}   H_2O   x_{12}          plain powers and subscripts
// Normal text without any of these is shown exactly as it is, and KaTeX is only loaded when a
// question really contains LaTeX, so quizzes without maths stay light on mobile data.

const CMDS = [
  'frac', 'dfrac', 'tfrac', 'sqrt', 'times', 'div', 'pm', 'mp', 'cdot', 'leq', 'geq', 'le', 'ge', 'neq', 'ne',
  'approx', 'equiv', 'propto', 'pi', 'theta', 'alpha', 'beta', 'gamma', 'delta', 'Delta', 'epsilon', 'lambda',
  'mu', 'sigma', 'Sigma', 'omega', 'Omega', 'rho', 'phi', 'tau', 'infty', 'circ', 'degree', 'to', 'rightarrow',
  'leftarrow', 'Rightarrow', 'leftrightarrow', 'rightleftharpoons', 'sum', 'int', 'log', 'ln', 'sin', 'cos',
  'tan', 'sec', 'cot', 'vec', 'hat', 'bar', 'overline', 'text', 'mathrm', 'ldots', 'cdots', 'perp', 'parallel',
  'angle', 'therefore', 'because', 'partial', 'nabla', 'uparrow', 'downarrow',
];
const BARE = new RegExp(`(\\\\(?:${CMDS.join('|')})(?![a-zA-Z])(?:\\[[^\\]]*\\])?(?:\\{[^{}]*\\}){0,2})`, 'g');
const DELIM = /\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;
const SCRIPT = /(\^(?:\{[^{}]*\}|\([^()]*\)|[+-]?\d+(?:\.\d+)?|[A-Za-z])|_(?:\{[^{}]*\}|\d+))/g;

// Splits on $...$ the way money is safe: "$5 and $10" stays plain text, because a closing $
// cannot follow a space or come before a digit.
function splitDollar(str) {
  const out = [];
  let buf = '';
  let i = 0;
  while (i < str.length) {
    const ch = str[i];
    if (ch === '\\' && str[i + 1] === '$') { buf += '$'; i += 2; continue; }
    if (ch === '$' && str[i + 1] && !/\s/.test(str[i + 1])) {
      let j = i + 1;
      let end = -1;
      while (j < str.length) {
        if (str[j] === '\\') { j += 2; continue; }
        if (str[j] === '$' && !/\s/.test(str[j - 1]) && !/\d/.test(str[j + 1] || '')) { end = j; break; }
        j++;
      }
      if (end > i + 1) {
        if (buf) out.push({ t: 'text', v: buf });
        buf = '';
        out.push({ t: 'math', v: str.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  if (buf) out.push({ t: 'text', v: buf });
  return out;
}

export function splitMath(input) {
  const s = String(input ?? '');
  // 1. \( ... \) and \[ ... \]
  const first = [];
  let last = 0;
  for (const m of s.matchAll(DELIM)) {
    if (m.index > last) first.push({ t: 'text', v: s.slice(last, m.index) });
    first.push({ t: 'math', v: m[1] ?? m[2] });
    last = m.index + m[0].length;
  }
  if (last < s.length) first.push({ t: 'text', v: s.slice(last) });

  // 2. $ ... $
  const second = first.flatMap((p) => (p.t === 'math' ? [p] : splitDollar(p.v)));

  // 3. bare LaTeX commands in what is left
  return second.flatMap((p) => {
    if (p.t === 'math') return [p];
    const text = p.v.replace(/\^\{?\\circ\}?/g, '°');
    return text.split(BARE).map((v, i) => ({ t: i % 2 ? 'math' : 'text', v })).filter((x) => x.v);
  });
}

const SUP = { fontSize: '0.75em', lineHeight: 0 };

// Plain powers and subscripts: x^2 becomes x with a raised 2, H_2O becomes H with a lowered 2.
function Plain({ text }) {
  return text.split(SCRIPT).map((p, i) => {
    if (i % 2 === 0) return p ? <Fragment key={i}>{p}</Fragment> : null;
    let body = p.slice(1);
    if (body[0] === '{' || body[0] === '(') body = body.slice(1, -1);
    body = body.replace(/-/g, '−');
    return p[0] === '^' ? <sup key={i} style={SUP}>{body}</sup> : <sub key={i} style={SUP}>{body}</sub>;
  });
}

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