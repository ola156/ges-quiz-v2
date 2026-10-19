// "Any issue? Reach out on WhatsApp". Reads the number from NEXT_PUBLIC_WHATSAPP (digits only, country code first, no +).
// Shows nothing when the variable is not set.
export default function HelpLink({ where = '' }) {
  const n = (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || '').replace(/\D/g, '');
  if (n.length < 8) return null;
  const text = encodeURIComponent('Hello, I need help with Instrict Quizmate.');
  return (
    <p className={`help-link ${where}`.trim()}>
      Any issue?{' '}
      <a href={`https://wa.me/${n}?text=${text}`} target="_blank" rel="noopener noreferrer">
        Reach out on WhatsApp
      </a>
    </p>
  );
}