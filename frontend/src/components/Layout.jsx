import { Link, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="shell">
      <header className="nav">
        <Link className="brand" to="/">
          <span className="brand-mark" aria-hidden="true">
            ◆
          </span>
          AI Capsule
        </Link>
        <nav className="nav-links">
          <Link to="/">About</Link>
          <Link to="/login">Sign in</Link>
        </nav>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <p>
          AI Capsule &middot; a private prompt library &middot; CSE3CWA Assignment 3
        </p>
      </footer>
    </div>
  );
}
