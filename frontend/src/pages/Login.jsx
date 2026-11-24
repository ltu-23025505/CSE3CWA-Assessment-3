import { useSearchParams } from 'react-router-dom';

const ERROR_MESSAGES = {
  token_exchange_failed:
    'GitHub refused the sign-in attempt. Check the OAuth app credentials and try again.',
  profile_failed: 'Signed in with GitHub, but reading your profile failed. Please try again.',
  github_unreachable: 'Could not reach GitHub. Check your connection and try again.',
};

export default function Login() {
  const [searchParams] = useSearchParams();
  const errorCode = searchParams.get('error');

  return (
    <section className="panel narrow">
      <h1>Sign in</h1>
      <p className="muted">
        AI Capsule uses your GitHub account to identify you. It reads your public profile only, and
        never posts anything on your behalf.
      </p>

      {errorCode ? (
        <div className="banner error">
          {ERROR_MESSAGES[errorCode] || 'Sign-in failed. Please try again.'}
        </div>
      ) : null}

      {/* A full page navigation, not a fetch: the server must redirect the browser to GitHub. */}
      <a className="button primary block" href="/auth/github">
        Continue with GitHub
      </a>

      <h2 className="stack-title">What happens next</h2>
      <ul className="ticks">
        <li>GitHub redirects you back to this application.</li>
        <li>The server verifies the request, then signs its own session token.</li>
        <li>
          The token is stored in a <strong>Secure, HttpOnly</strong> cookie, so page scripts cannot
          read it and it is never exposed in a URL.
        </li>
        <li>You land on your private dashboard.</li>
      </ul>
    </section>
  );
}
