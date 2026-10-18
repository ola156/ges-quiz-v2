import Link from 'next/link';
import SiteHeader from '../components/SiteHeader';
import CodeBox from '../components/CodeBox';
import { PARTNER } from '../lib/brand';

export const dynamic = 'force-dynamic';

export default function Landing() {
  return (
    <div className="lp">
      <SiteHeader />

      <section className="lp-hero">
        <div className="lp-hero-text">
          <h1 className="lp-title">Mock exams that mark themselves.</h1>
          <p className="lp-lede">
            Type the code your tutor wrote on the board, or open the link they sent, and start.
            You get your score and the correction for every question the moment you submit.
          </p>

          <div className="card lp-code">
            <h2 className="lp-code-title">Have a code or a link?</h2>
            <CodeBox />
            <p className="lp-fine">No account needed to take a quiz.</p>
          </div>

          <p className="lp-aside">
            Looking for UI GES or GST practice? <Link href="/browse">Browse the practice sets</Link>.
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
            <p>Name in, timer starts. The timer runs on our server, so closing the tab or refreshing does not buy extra minutes.</p>
          </li>
          <li>
            <span className="lp-n" aria-hidden="true">3</span>
            <h3>Everyone sees where they stand</h3>
            <p>Corrections with explanations appear straight away, and scores land on the leaderboard for that set.</p>
          </li>
        </ol>
      </section>

      <section className="lp-sec lp-aud" aria-label="Choose how you will use it">
        <div className="card lp-student">
          <h2>Studying on your own?</h2>
          <p>Make a free account, tell us whether you are preparing for JAMB, WAEC, Post-UTME or university, and we show you what applies to you.</p>
          <ul className="lp-list">
            <li>Free, with no ads</li>
            <li>Corrections that explain the answer</li>
            <li>Leaderboards by course and department</li>
          </ul>
          <Link href="/sign-up?role=student" className="btn">Create a student account</Link>
        </div>

        <div className="lp-tutor">
          <h2>Teaching a class or running a centre?</h2>
          <p>Put the whole room in the same exam with one code. Your students never have to sign up.</p>
          <ul className="lp-list">
            <li>One code or link for the whole class</li>
            <li>A server-side timer nobody can pause</li>
            <li>Your first session is free</li>
          </ul>
          <Link href="/sign-up?role=tutor" className="btn light">Create a tutor account</Link>
        </div>
      </section>

      <footer className="lp-foot">
        <span>{PARTNER}</span>
        <span className="lp-foot-links">
          <Link href="/sign-in">Sign in</Link>
          <Link href="/browse">Practice sets</Link>
        </span>
      </footer>
    </div>
  );
}
