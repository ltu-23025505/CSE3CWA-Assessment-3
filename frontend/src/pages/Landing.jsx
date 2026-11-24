import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Private prompt library</p>
        <h1>Stop losing the prompts that actually worked.</h1>
        <p className="lede">
          AI Capsule keeps your useful AI prompts in one place: the prompt itself, the project it
          belongs to, what the model replied, how useful it was, and whether you reviewed and
          improved it. Each record is visible only to the account that created it.
        </p>
        <div className="hero-actions">
          <Link className="button primary" to="/login">
            Sign in with GitHub
          </Link>
        </div>
      </section>

      <section className="features">
        <article className="feature">
          <h2>Keep the whole record</h2>
          <p>
            Project, title, version, prompt text, response summary, category, usefulness, review and
            improvement flags, screenshot link and your own notes — stored together.
          </p>
        </article>
        <article className="feature">
          <h2>Own your data</h2>
          <p>
            Every record is owned by the GitHub identity that created it. Reads, updates and deletes
            are scoped to you in the database itself, not filtered in the browser.
          </p>
        </article>
        <article className="feature">
          <h2>Real session, not a fake one</h2>
          <p>
            Sign-in returns a session token that the server issues, signs and verifies. It lives in a
            Secure, HttpOnly cookie, so scripts on the page cannot read it.
          </p>
        </article>
      </section>

      <section className="panel">
        <h2>How it works</h2>
        <ol className="steps">
          <li>
            <strong>Sign in with GitHub.</strong> The server receives a one-time code, exchanges it for
            your public profile, then discards it.
          </li>
          <li>
            <strong>The server starts your session.</strong> It signs its own token and sets it as an
            HttpOnly cookie — the login is the server&rsquo;s, not GitHub&rsquo;s.
          </li>
          <li>
            <strong>Manage your capsules.</strong> Create, read, update and delete your own prompt
            records from the dashboard.
          </li>
        </ol>
      </section>
    </>
  );
}
