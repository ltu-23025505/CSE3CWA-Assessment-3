function Flag({ on, children }) {
  return <span className={on ? 'flag yes' : 'flag no'}>{children}</span>;
}

function formatDate(value) {
  if (!value) return null;
  // SQLite stores "YYYY-MM-DD HH:MM:SS" in UTC.
  const parsed = new Date(value.replace(' ', 'T') + 'Z');
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export default function CapsuleCard({ capsule, onEdit, onDelete }) {
  return (
    <article className="capsule">
      <header className="capsule-head">
        <div>
          <h3>{capsule.prompt_title}</h3>
          <p className="capsule-project">
            {capsule.project_name}
            {capsule.prompt_version ? <span className="version">{capsule.prompt_version}</span> : null}
          </p>
        </div>
        <div className="capsule-tags">
          {capsule.category ? <span className="tag">{capsule.category}</span> : null}
          {capsule.usefulness ? (
            <span className={capsule.usefulness === 'Good' ? 'tag good' : 'tag warn'}>
              {capsule.usefulness}
            </span>
          ) : null}
        </div>
      </header>

      <div className="capsule-block">
        <h4>Prompt</h4>
        <pre className="prompt-text">{capsule.prompt_text}</pre>
      </div>

      {capsule.response_summary ? (
        <div className="capsule-block">
          <h4>Response summary</h4>
          <p>{capsule.response_summary}</p>
        </div>
      ) : null}

      {capsule.notes ? (
        <div className="capsule-block">
          <h4>Notes</h4>
          <p>{capsule.notes}</p>
        </div>
      ) : null}

      <div className="capsule-flags">
        <Flag on={capsule.reviewed === 1}>Reviewed</Flag>
        <Flag on={capsule.improved === 1}>Improved</Flag>
        {capsule.screenshot_url ? (
          <a
            className="flag link"
            href={capsule.screenshot_url}
            target="_blank"
            rel="noreferrer noopener"
          >
            Screenshot
          </a>
        ) : null}
      </div>

      <footer className="capsule-foot">
        <span className="muted small">Created {formatDate(capsule.created_at)}</span>
        <div className="capsule-actions">
          <button type="button" className="button ghost" onClick={() => onEdit(capsule)}>
            Edit
          </button>
          <button type="button" className="button danger" onClick={() => onDelete(capsule)}>
            Delete
          </button>
        </div>
      </footer>
    </article>
  );
}
