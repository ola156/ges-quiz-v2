'use client';
import { useMemo, useState } from 'react';

// A small scientific calculator for quizzes that allow one. No eval: the expression is
// read by a tiny parser that only understands numbers, operators, brackets and these functions.

const FUNCS = ['sin', 'cos', 'tan', 'log', 'ln'];

function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/[\d.]/.test(c)) {
      let j = i;
      while (j < src.length && /[\d.]/.test(src[j])) j++;
      out.push({ k: 'num', v: src.slice(i, j) });
      i = j;
      continue;
    }
    const rest = src.slice(i);
    const fn = FUNCS.find((n) => rest.startsWith(n));
    if (fn) { out.push({ k: 'fn', v: fn }); i += fn.length; continue; }
    if (rest.startsWith('Ans')) { out.push({ k: 'ans' }); i += 3; continue; }
    if (c === 'π') { out.push({ k: 'const', v: Math.PI }); i++; continue; }
    if (c === 'e') { out.push({ k: 'const', v: Math.E }); i++; continue; }
    if (c === '√') { out.push({ k: 'fn', v: 'sqrt' }); i++; continue; }
    if ('+−×÷^%()'.includes(c)) { out.push({ k: 'op', v: c }); i++; continue; }
    throw new Error('bad input');
  }
  return out;
}

export function evaluate(src, deg = true, ans = 0) {
  const opens = (src.match(/\(/g) || []).length;
  const closes = (src.match(/\)/g) || []).length;
  if (closes > opens) throw new Error('brackets');
  const tokens = tokenize(src + ')'.repeat(opens - closes)); // missing closing brackets are added for you
  let p = 0;
  const isOp = (v) => tokens[p] && tokens[p].k === 'op' && tokens[p].v === v;
  const startsFactor = () => {
    const t = tokens[p];
    return t && (t.k === 'num' || t.k === 'const' || t.k === 'ans' || t.k === 'fn' || (t.k === 'op' && t.v === '('));
  };
  const need = (ok) => { if (!ok) throw new Error('syntax'); };

  function expr() {
    let v = term();
    while (isOp('+') || isOp('−')) {
      const o = tokens[p++].v;
      const r = term();
      v = o === '+' ? v + r : v - r;
    }
    return v;
  }
  function term() {
    let v = unary();
    for (;;) {
      if (isOp('×') || isOp('÷')) {
        const o = tokens[p++].v;
        const r = unary();
        v = o === '×' ? v * r : v / r;
      } else if (startsFactor()) {
        v *= unary(); // 2π, 3(4+1), 2sin(30)
      } else break;
    }
    return v;
  }
  function unary() {
    if (isOp('−')) { p++; return -unary(); }
    if (isOp('+')) { p++; return unary(); }
    return power();
  }
  function power() {
    const b = postfix();
    if (isOp('^')) { p++; return Math.pow(b, unary()); }
    return b;
  }
  function postfix() {
    let v = primary();
    while (isOp('%')) { p++; v /= 100; }
    return v;
  }
  function primary() {
    const t = tokens[p++];
    need(t);
    if (t.k === 'num') { const v = Number(t.v); need(!Number.isNaN(v)); return v; }
    if (t.k === 'const') return t.v;
    if (t.k === 'ans') return ans;
    if (t.k === 'op' && t.v === '(') {
      const v = expr();
      need(isOp(')'));
      p++;
      return v;
    }
    need(t.k === 'fn');
    need(isOp('('));
    p++;
    const a = expr();
    need(isOp(')'));
    p++;
    if (t.v === 'sqrt') { need(a >= 0); return Math.sqrt(a); }
    if (t.v === 'log') { need(a > 0); return Math.log10(a); }
    if (t.v === 'ln') { need(a > 0); return Math.log(a); }
    const x = deg ? (a * Math.PI) / 180 : a;
    if (t.v === 'tan') {
      need(Math.abs(Math.cos(x)) > 1e-14);
      const v = Math.tan(x);
      return Math.abs(v) < 1e-14 ? 0 : v;
    }
    const v = t.v === 'sin' ? Math.sin(x) : Math.cos(x);
    return Math.abs(v) < 1e-14 ? 0 : v; // sin(180) is 0, not 1.2e-16
  }

  const v = expr();
  need(p === tokens.length);
  need(Number.isFinite(v));
  return v;
}

export function fmt(v) {
  const r = parseFloat(v.toPrecision(12));
  if (r === 0) return '0';
  const a = Math.abs(r);
  if (a >= 1e12 || a < 1e-6) return r.toExponential().replace('e+', 'e');
  return String(r);
}

const OPS = ['+', '−', '×', '÷', '^', '%', '^2', '×10^'];

const ROWS = [
  [['deg', 'DEG'], ['(', '('], [')', ')'], ['back', '⌫', 'Backspace'], ['clear', 'C', 'Clear']],
  [['sin(', 'sin'], ['cos(', 'cos'], ['tan(', 'tan'], ['log(', 'log'], ['ln(', 'ln']],
  [['√(', '√', 'Square root'], ['^2', 'x²', 'Squared'], ['^', 'xʸ', 'Power'], ['π', 'π', 'Pi'], ['e', 'e', 'e']],
  [['7'], ['8'], ['9'], ['÷', '÷', 'Divide'], ['×', '×', 'Times']],
  [['4'], ['5'], ['6'], ['−', '−', 'Minus'], ['+', '+', 'Plus']],
  [['1'], ['2'], ['3'], ['×10^', 'EXP', 'Times ten to the power'], ['Ans', 'Ans', 'Previous answer']],
  [['0'], ['.'], ['%', '%', 'Percent'], ['=', '=', 'Equals', 2]],
];

export default function Calculator() {
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState('');
  const [ans, setAns] = useState(0);
  const [deg, setDeg] = useState(true);
  const [fresh, setFresh] = useState(false); // the last key pressed was "="

  // While typing, show the answer so far if the expression is already complete.
  const live = useMemo(() => {
    if (!expr) return '';
    try { return fmt(evaluate(expr, deg, ans)); } catch { return ''; }
  }, [expr, deg, ans]);

  function add(s) {
    const isOp = OPS.includes(s);
    let base = expr;
    if (fresh) {
      base = isOp ? 'Ans' : ''; // keep going from the last answer, or start fresh
      setFresh(false);
      setResult('');
    }
    if (s === '.' && (/[\d.]*$/.exec(base)[0] || '').includes('.')) return;
    if (['+', '×', '÷'].includes(s) && /[+−×÷]$/.test(base)) base = base.slice(0, -1);
    setExpr(base + s);
  }

  function press(code) {
    if (code === 'deg') return setDeg((d) => !d);
    if (code === 'clear') { setExpr(''); setResult(''); setFresh(false); return; }
    if (code === 'back') {
      if (fresh) { setFresh(false); setResult(''); }
      setExpr((e) => e.replace(/(sin\(|cos\(|tan\(|log\(|ln\(|√\(|Ans|×10\^|.)$/, ''));
      return;
    }
    if (code === '=') {
      if (!expr) return;
      try {
        const v = evaluate(expr, deg, ans);
        setAns(v);
        setResult(fmt(v));
      } catch {
        setResult('Error');
      }
      setFresh(true);
      return;
    }
    add(code);
  }

  const shown = result || live;

  return (
    <div className="card" style={{ display: 'grid', gap: 8 }}>
      <div style={{ textAlign: 'right', minHeight: 56 }}>
        <div className="muted small" style={{ overflowX: 'auto', whiteSpace: 'nowrap', minHeight: '1.3em' }}>{expr || ' '}</div>
        <strong style={{ fontSize: '1.6rem', overflowX: 'auto', whiteSpace: 'nowrap', display: 'block', minHeight: '1.3em' }}>
          {shown || ' '}
        </strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {ROWS.flat().map(([code, label, aria, span]) => (
          <button
            key={code}
            type="button"
            className={code === '=' ? 'btn sm' : 'btn sm ghost'}
            aria-label={aria || label || code}
            style={{ padding: '10px 0', minWidth: 0, fontSize: '0.95rem', gridColumn: span ? `span ${span}` : undefined }}
            onClick={() => press(code)}
          >
            {code === 'deg' ? (deg ? 'DEG' : 'RAD') : label || code}
          </button>
        ))}
      </div>
    </div>
  );
}