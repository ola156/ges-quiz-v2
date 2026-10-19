import Link from 'next/link';
import SiteHeader from '../components/SiteHeader';
import CodeBox from '../components/CodeBox';
import HelpLink from '../components/HelpLink';
import { PARTNER } from '../lib/brand';

export const dynamic = 'force-dynamic';

// What the study screen looks like. A drawing of the real thing, with made-up progress.
const SAMPLE_ROWS = [
  { n: '01', t: 'Atomic structure and bonding', s: '4 of 4 subtopics done', done: true },
  { n: '02', t: 'Acids, bases and salts', s: '2 of 5 subtopics done' },
  { n: '03', t: 'Rates of reaction', s: 'Not started' },
  { n: '04', t: 'Organic chemistry', s: 'Not started' },
];

export default function Landing() {
  return (
    <div className="lp">
      <SiteHeader />

      <section className="lp-hero">
        <div className="lp-hero-text">
          <h1 className="lp-title">Study the syllabus. Sit the mock exam.</h1>
          <p className="lp-lede">
            Work through JAMB, WAEC, Post-UTME and university topics one short lesson at a time,
            then sit the mock your tutor sets. Every answer comes back corrected, with the reason.
          </p>

          <div className="card lp-code">
            <h2 className="lp-code-title">Have a code or a link?</h2>
            <CodeBox />
            <p className="lp-fine">No account needed to take a quiz.</p>
          </div>

          <p className="lp-aside">
            Studying on your own? <a href="#study">See how study mode works</a>.
          </p>
        </div>

        <figure className="lp-sample" aria-label="Example of a corrected question">
          <p className="lp-q">A 2 kg mass accelerates at 3 m/s<sup>2</sup>. What is the net force on it?</p>
          <ul className="lp-opts">
            <li className="lp-opt"><b>A</b> 1.5 N</li>
            <li className="lp-opt is-wrong"><b>B</b> 5 N</li>
            <li className="lp-opt is-right"><b>C</b> 6 N</li>
            <li className="lp-opt"><b>D</b> 9 N</li>
          </ul>
          <div className="lp-fix">
            <strong>You picked B. The answer is C.</strong>
            <p>Net force is mass times acceleration, so 2 &times; 3 = 6 N.</p>
          </div>
        </figure>
      </section>

      <section id="study" className="lp2-study" aria-labelledby="study-h">
        <div className="lp2-text">
          <span className="lp2-eyebrow">Study mode</span>
          <h2 id="study-h" className="lp2-h2">A syllabus you can actually finish.</h2>
          <p className="lp2-copy">
            Every subject is split into topics, and every topic into short subtopics. Read the summary cards,
            take the quiz, and score 60% or more to tick it off. Then move to the next one.
          </p>
          <ol className="lp2-points">
            <li>
              <span className="no">01</span>
              <strong>Cards first, quiz second</strong>
              <span className="d">Each subtopic opens with a few summary cards you can get through in minutes, so the quiz tests what you just read.</span>
            </li>
            <li>
              <span className="no">02</span>
              <strong>Corrections that explain</strong>
              <span className="d">A wrong answer shows you the right one and why it is right, not just a red mark.</span>
            </li>
            <li>
              <span className="no">03</span>
              <strong>It remembers where you stopped</strong>
              <span className="d">Your home page opens on the last subtopic you were reading. One tap and you are back in.</span>
            </li>
          </ol>
          <p className="lp2-cta"><Link href="/sign-up?role=student" className="lp2-go">Start studying free <span aria-hidden="true">&rarr;</span></Link></p>
        </div>

        <figure className="lp2-app" aria-label="Example of the study screen">
          <div className="lp2-app-bar"><span>Study / JAMB / Chemistry</span><span>Example</span></div>
          <div className="lp2-app-body">
            <h3>Chemistry</h3>
            <div className="lp2-app-sub"><span>12 of 38 subtopics done</span><span>32%</span></div>
            <div className="lp2-meter" aria-hidden="true"><span style={{ width: '32%' }} /></div>
            <ul className="lp2-rows">
              {SAMPLE_ROWS.map((r) => (
                <li key={r.n} className="lp2-row">
                  <span className="n">{r.n}</span>
                  <span className="t">{r.t}<small>{r.s}</small></span>
                  {r.done ? <span className="tick" aria-label="Done">&#10003;</span> : <span className="chev" aria-hidden="true">&rsaquo;</span>}
                </li>
              ))}
            </ul>
          </div>
          <div className="lp2-resume">
            <span className="l">Continue where you stopped</span>
            <strong>Acids, bases and salts</strong>
            <span className="s">Cards read, quiz next</span>
            <span className="go" aria-hidden="true">&rarr;</span>
          </div>
        </figure>
      </section>

      <section className="lp-sec" aria-labelledby="how">
        <h2 id="how" className="lp-h2">How a class mock runs</h2>
        <ol className="lp-steps">
          <li>
            <span className="lp-n" aria-hidden="true">1</span>
            <h3>The tutor shares a code</h3>
            <p>The set is ready before class. The tutor writes its code on the board or sends the link to the class group.</p>
          </li>
          <li>
            <span className="lp-n" aria-hidden="true">2</span>
            <h3>Students type it in</h3>
            <p>Name in, pick your subjects if it is a combined exam, and the timer starts. It runs on our server, so closing the tab or refreshing does not buy extra minutes.</p>
          </li>
          <li>
            <span className="lp-n" aria-hidden="true">3</span>
            <h3>Everyone sees where they stand</h3>
            <p>Corrections with explanations appear straight away, and the tutor gets every score, subject by subject.</p>
          </li>
        </ol>
      </section>

      <section className="lp-sec lp-aud" aria-label="Choose how you will use it">
        <div className="card lp-student">
          <h2>Studying on your own?</h2>
          <p>Make a free account and tell us whether you are preparing for JAMB, WAEC, Post-UTME or university. We show you the syllabus that applies to you and keep your place in it.</p>
          <ul className="lp-list">
            <li>Free, with no ads</li>
            <li>Topic-by-topic study with a quiz for each one</li>
            <li>Corrections that explain the answer</li>
          </ul>
          <Link href="/sign-up?role=student" className="btn">Create a student account</Link>
        </div>

        <div className="lp-tutor">
          <h2>Teaching a class or running a centre?</h2>
          <p>Put the whole room in the same exam with one code. Your students never have to sign up.</p>
          <ul className="lp-list">
            <li>One code or link for the whole class</li>
            <li>Students pick their own subjects, JAMB style</li>
            <li>A server-side timer nobody can pause</li>
            <li>Your first session is free</li>
          </ul>
          <Link href="/sign-up?role=tutor" className="btn light">Create a tutor account</Link>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-foot-left">
          <span>{PARTNER}</span>
          <HelpLink where="in-foot" />
        </div>
        <span className="lp-foot-links">
          <Link href="/sign-in">Sign in</Link>
          <Link href="/practice">Practice quizzes</Link>
        </span>
      </footer>
    </div>
  );
}