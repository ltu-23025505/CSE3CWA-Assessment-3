import { useState } from 'react';

const MAX_SHORT = 200;
const MAX_NOTES = 2000;

const CATEGORIES = ['Coding', 'Writing', 'Research', 'Other'];
const USEFULNESS = ['Good', 'Needs Improvement'];

const EMPTY_VALUES = {
  project_name: '',
  prompt_title: '',
  prompt_version: '',
  prompt_text: '',
  response_summary: '',
  category: '',
  usefulness: '',
  reviewed: false,
  improved: false,
  screenshot_url: '',
  notes: '',
};

// The API stores booleans as 0/1, so normalise when filling the edit form.
export function capsuleToFormValues(capsule) {
  return {
    project_name: capsule.project_name ?? '',
    prompt_title: capsule.prompt_title ?? '',
    prompt_version: capsule.prompt_version ?? '',
    prompt_text: capsule.prompt_text ?? '',
    response_summary: capsule.response_summary ?? '',
    category: capsule.category ?? '',
    usefulness: capsule.usefulness ?? '',
    reviewed: capsule.reviewed === 1 || capsule.reviewed === true,
    improved: capsule.improved === 1 || capsule.improved === true,
    screenshot_url: capsule.screenshot_url ?? '',
    notes: capsule.notes ?? '',
  };
}

export function formValuesToPayload(values) {
  return {
    project_name: values.project_name.trim(),
    prompt_title: values.prompt_title.trim(),
    prompt_version: values.prompt_version.trim(),
    prompt_text: values.prompt_text.trim(),
    response_summary: values.response_summary.trim(),
    category: values.category,
    usefulness: values.usefulness,
    reviewed: values.reviewed,
    improved: values.improved,
    screenshot_url: values.screenshot_url.trim(),
    notes: values.notes.trim(),
  };
}

// Mirrors the server rules so the user gets feedback before a round trip.
// The server still validates everything again.
function validate(values) {
  const errors = {};

  if (!values.project_name.trim()) errors.project_name = 'Project name is required.';
  else if (values.project_name.trim().length > MAX_SHORT) {
    errors.project_name = `Keep this to ${MAX_SHORT} characters or fewer.`;
  }

  if (!values.prompt_title.trim()) errors.prompt_title = 'Prompt title is required.';
  else if (values.prompt_title.trim().length > MAX_SHORT) {
    errors.prompt_title = `Keep this to ${MAX_SHORT} characters or fewer.`;
  }

  if (!values.prompt_text.trim()) errors.prompt_text = 'The prompt itself is required.';

  if (values.notes.length > MAX_NOTES) {
    errors.notes = `Notes must be ${MAX_NOTES} characters or fewer.`;
  }

  const url = values.screenshot_url.trim();
  if (url && !/^https?:\/\/\S+$/i.test(url)) {
    errors.screenshot_url = 'Use a full URL starting with http:// or https://';
  }

  return errors;
}

export default function CapsuleForm({ mode, capsule, onSubmit, onCancel }) {
  const isEdit = mode === 'edit';

  const [values, setValues] = useState(() =>
    isEdit ? capsuleToFormValues(capsule) : { ...EMPTY_VALUES }
  );
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setValues((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const found = validate(values);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      await onSubmit(formValuesToPayload(values));
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <h2>{isEdit ? `Edit capsule — ${capsule.prompt_title}` : 'New capsule'}</h2>

      {formError ? <div className="banner error">{formError}</div> : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="project_name">Project *</label>
            <input
              id="project_name"
              value={values.project_name}
              onChange={(event) => update('project_name', event.target.value)}
              placeholder="SmartFarm Irrigation"
            />
            {errors.project_name ? <span className="field-error">{errors.project_name}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="prompt_title">Prompt title *</label>
            <input
              id="prompt_title"
              value={values.prompt_title}
              onChange={(event) => update('prompt_title', event.target.value)}
              placeholder="Debug cloud deployment"
            />
            {errors.prompt_title ? <span className="field-error">{errors.prompt_title}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="prompt_version">Version</label>
            <input
              id="prompt_version"
              value={values.prompt_version}
              onChange={(event) => update('prompt_version', event.target.value)}
              placeholder="v1"
            />
          </div>

          <div className="field">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={values.category}
              onChange={(event) => update('category', event.target.value)}
            >
              <option value="">Not set</option>
              {CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="usefulness">Usefulness</label>
            <select
              id="usefulness"
              value={values.usefulness}
              onChange={(event) => update('usefulness', event.target.value)}
            >
              <option value="">Not set</option>
              {USEFULNESS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="field checkbox-field">
            <label htmlFor="reviewed">
              <input
                id="reviewed"
                type="checkbox"
                checked={values.reviewed}
                onChange={(event) => update('reviewed', event.target.checked)}
              />
              I reviewed the response
            </label>
            <label htmlFor="improved">
              <input
                id="improved"
                type="checkbox"
                checked={values.improved}
                onChange={(event) => update('improved', event.target.checked)}
              />
              The output improved
            </label>
          </div>

          <div className="field full">
            <label htmlFor="prompt_text">Prompt *</label>
            <textarea
              id="prompt_text"
              rows={5}
              value={values.prompt_text}
              onChange={(event) => update('prompt_text', event.target.value)}
              placeholder="The exact prompt you used…"
            />
            {errors.prompt_text ? <span className="field-error">{errors.prompt_text}</span> : null}
          </div>

          <div className="field full">
            <label htmlFor="response_summary">Response summary</label>
            <textarea
              id="response_summary"
              rows={3}
              value={values.response_summary}
              onChange={(event) => update('response_summary', event.target.value)}
              placeholder="What the model replied, in a sentence or two…"
            />
          </div>

          <div className="field full">
            <label htmlFor="screenshot_url">Screenshot evidence URL</label>
            <input
              id="screenshot_url"
              value={values.screenshot_url}
              onChange={(event) => update('screenshot_url', event.target.value)}
              placeholder="https://…"
            />
            {errors.screenshot_url ? (
              <span className="field-error">{errors.screenshot_url}</span>
            ) : (
              <span className="hint">Optional link to a screenshot.</span>
            )}
          </div>

          <div className="field full">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              rows={2}
              value={values.notes}
              onChange={(event) => update('notes', event.target.value)}
              placeholder="Reflection or comment…"
            />
            {errors.notes ? <span className="field-error">{errors.notes}</span> : null}
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="button primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create capsule'}
          </button>
          <button type="button" className="button ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
