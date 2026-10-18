// Scoring helpers for the results page and the Excel file.

// JAMB: every subject is marked out of 100 and the subjects are added up (four subjects make 400).
export function jambTotal(subjects, names) {
  let sum = 0;
  for (const n of names) {
    const s = subjects?.[n];
    if (s && s[1]) sum += (s[0] / s[1]) * 100;
  }
  return Math.round(sum);
}

// WAEC grade for a percentage.
export function waecGrade(pct) {
  if (pct >= 75) return 'A1';
  if (pct >= 70) return 'B2';
  if (pct >= 65) return 'B3';
  if (pct >= 60) return 'C4';
  if (pct >= 55) return 'C5';
  if (pct >= 50) return 'C6';
  if (pct >= 45) return 'D7';
  if (pct >= 40) return 'E8';
  return 'F9';
}