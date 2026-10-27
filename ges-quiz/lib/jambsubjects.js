// The subjects JAMB students can ask for. Students vote for the ones that are not built yet.
// Check the current JAMB brochure and edit this list if subjects change.
export const JAMB_SUBJECTS = [
  'Use of English',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Agricultural Science',
  'Economics',
  'Commerce',
  'Principles of Accounts',
  'Government',
  'Literature in English',
  'Christian Religious Studies',
  'Islamic Studies',
  'Geography',
  'History',
  'Civic Education',
];

export const subjectKey = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');