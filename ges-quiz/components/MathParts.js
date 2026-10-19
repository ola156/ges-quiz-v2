import { Fragment } from 'react';

// Shared by Rich (client) and MathText (server). No hooks here, so both can import it.
// It cuts a string into plain text and maths pieces, and can also give a readable one line
// version for places that cannot draw maths (select boxes, confirm popups).

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
export function Plain({ text }) {
  return text.split(SCRIPT).map((p, i) => {
    if (i % 2 === 0) return p ? <Fragment key={i}>{p}</Fragment> : null;
    let body = p.slice(1);
    if (body[0] === '{' || body[0] === '(') body = body.slice(1, -1);
    body = body.replace(/-/g, '−');
    return p[0] === '^' ? <sup key={i} style={SUP}>{body}</sup> : <sub key={i} style={SUP}>{body}</sub>;
  });
}


const SUPS = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', n: 'ⁿ' };
const SUBS = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
const SYM = {
  times: '×', div: '÷', pm: '±', mp: '∓', cdot: '·', leq: '≤', geq: '≥', le: '≤', ge: '≥', neq: '≠', ne: '≠',
  approx: '≈', equiv: '≡', propto: '∝', pi: 'π', theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ',
  Delta: 'Δ', epsilon: 'ε', lambda: 'λ', mu: 'μ', sigma: 'σ', Sigma: 'Σ', omega: 'ω', Omega: 'Ω', rho: 'ρ',
  phi: 'φ', tau: 'τ', infty: '∞', circ: '°', degree: '°', to: '→', rightarrow: '→', leftarrow: '←',
  Rightarrow: '⇒', leftrightarrow: '↔', rightleftharpoons: '⇌', sum: 'Σ', int: '∫', ldots: '...', cdots: '...',
  perp: '⊥', parallel: '∥', angle: '∠', therefore: '∴', because: '∵', partial: '∂', nabla: '∇',
  uparrow: '↑', downarrow: '↓',
};

function plainTex(s) {
  let t = String(s);
  for (let i = 0; i < 4; i++) t = t.replace(/\\d?t?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)');
  t = t.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)').replace(/\\sqrt\s*(\w)/g, '√$1');
  t = t.replace(/\\(?:text|mathrm|overline|bar|vec|hat)\s*\{([^{}]*)\}/g, '$1');
  t = t.replace(/\\([a-zA-Z]+)/g, (m, name) => SYM[name] ?? name);
  t = t.replace(/\^\{([^{}]*)\}|\^([+-]?\d+|[A-Za-z])/g, (m, a, b) => {
    const v = a ?? b;
    return [...v].every((c) => SUPS[c]) ? [...v].map((c) => SUPS[c]).join('') : `^(${v})`;
  });
  t = t.replace(/_\{([^{}]*)\}|_(\d)/g, (m, a, b) => {
    const v = a ?? b;
    return [...v].every((c) => SUBS[c]) ? [...v].map((c) => SUBS[c]).join('') : v;
  });
  return t.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}

// One readable line with no formatting, for <option> boxes and window.confirm.
export function plainMath(input) {
  return splitMath(input)
    .map((p) => (p.t === 'math' ? plainTex(p.v) : p.v.replace(/\^\{?\\circ\}?/g, '°')))
    .join('');
}