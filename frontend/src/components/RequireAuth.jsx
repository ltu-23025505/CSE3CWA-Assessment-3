import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import { getMe } from '../services/api';

// Client-side guard for the protected routes.
//
// This is convenience only. The authority is the API: every /api/capsules route
// verifies the JWT itself, so a user who bypasses this component still gets 401.
export default function RequireAuth() {
  const [status, setStatus] = useState('checking');
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getMe()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!cancelled) setStatus('anonymous');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'checking') {
    return (
      <div className="panel narrow">
        <p className="muted">Checking your session…</p>
      </div>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet context={user} />;
}
