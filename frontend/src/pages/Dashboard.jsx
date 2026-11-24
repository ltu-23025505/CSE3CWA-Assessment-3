import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import CapsuleForm from '../components/CapsuleForm.jsx';
import CapsuleCard from '../components/CapsuleCard.jsx';
import { createCapsule, deleteCapsule, listCapsules, updateCapsule } from '../services/api';

export default function Dashboard() {
  const user = useOutletContext();

  const [capsules, setCapsules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState(null); // { mode: 'create' } | { mode: 'edit', capsule }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCapsules(await listCapsules());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(payload) {
    const created = await createCapsule(payload);
    setForm(null);
    await load();
    setNotice(`Created "${created.prompt_title}".`);
  }

  async function handleUpdate(id, payload) {
    const updated = await updateCapsule(id, payload);
    setForm(null);
    await load();
    setNotice(`Updated "${updated.prompt_title}".`);
  }

  async function handleDelete(capsule) {
    if (!window.confirm(`Delete "${capsule.prompt_title}"? This cannot be undone.`)) return;

    try {
      await deleteCapsule(capsule.id);
      await load();
      setNotice(`Deleted "${capsule.prompt_title}".`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <section className="panel dashboard-head">
        <div className="who">
          {user.avatar ? <img className="avatar" src={user.avatar} alt="" /> : null}
          <div>
            <h1>Your capsules</h1>
            <p className="muted small">
              Signed in as <strong>{user.name || user.login}</strong> ({user.login})
            </p>
          </div>
        </div>
        <div className="head-actions">
          <button
            type="button"
            className="button primary"
            onClick={() => {
              setNotice(null);
              setForm({ mode: 'create' });
            }}
          >
            New capsule
          </button>
          <a className="button ghost" href="/auth/logout">
            Sign out
          </a>
        </div>
      </section>

      {notice ? (
        <div className="banner success">
          {notice}{' '}
          <button type="button" className="link-button" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="banner error">
          {error}
          <div className="banner-actions">
            <button type="button" className="button primary" onClick={load}>
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {form ? (
        <CapsuleForm
          key={form.mode === 'edit' ? `edit-${form.capsule.id}` : 'create'}
          mode={form.mode}
          capsule={form.capsule}
          onSubmit={form.mode === 'edit' ? (payload) => handleUpdate(form.capsule.id, payload) : handleCreate}
          onCancel={() => setForm(null)}
        />
      ) : null}

      {loading ? (
        <p className="muted loading">Loading your capsules…</p>
      ) : capsules.length === 0 ? (
        <div className="empty">
          <h2>No capsules yet</h2>
          <p>
            Save your first prompt with <strong>New capsule</strong>. Only you can see the records you
            create here.
          </p>
        </div>
      ) : (
        <div className="capsule-list">
          <p className="muted small count">
            {capsules.length} capsule{capsules.length === 1 ? '' : 's'}
          </p>
          {capsules.map((capsule) => (
            <CapsuleCard
              key={capsule.id}
              capsule={capsule}
              onEdit={(target) => {
                setNotice(null);
                setForm({ mode: 'edit', capsule: target });
              }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </>
  );
}
