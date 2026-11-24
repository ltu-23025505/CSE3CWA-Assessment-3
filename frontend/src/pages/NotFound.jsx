import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="panel narrow">
      <h1>Page not found</h1>
      <p className="muted">That page does not exist.</p>
      <Link className="button primary" to="/">
        Back to the home page
      </Link>
    </section>
  );
}
