// Validation for capsule payloads.
//
// Note what is deliberately absent: user_id. Ownership always comes from the
// verified JWT, so a client that sends user_id in the body cannot influence it.

const MAX_NOTES = 2000;
const MAX_SHORT_FIELD = 200;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Accepts true/false and the 0/1 forms the database stores.
function toBooleanFlag(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (value === true || value === 1 || value === '1' || value === 'true') return 1;
  if (value === false || value === 0 || value === '0' || value === 'false') return 0;
  return null; // anything else is not a boolean
}

function validateCapsule(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object' };
  }

  const projectName = text(body.project_name);
  if (!projectName) return { error: 'project_name is required' };
  if (projectName.length > MAX_SHORT_FIELD) {
    return { error: `project_name must be ${MAX_SHORT_FIELD} characters or fewer` };
  }

  const promptTitle = text(body.prompt_title);
  if (!promptTitle) return { error: 'prompt_title is required' };
  if (promptTitle.length > MAX_SHORT_FIELD) {
    return { error: `prompt_title must be ${MAX_SHORT_FIELD} characters or fewer` };
  }

  const promptText = text(body.prompt_text);
  if (!promptText) return { error: 'prompt_text is required' };

  const notes = text(body.notes);
  if (notes.length > MAX_NOTES) {
    return { error: `notes must be ${MAX_NOTES} characters or fewer` };
  }

  const reviewed = toBooleanFlag(body.reviewed);
  if (reviewed === null) return { error: 'reviewed must be a boolean' };

  const improved = toBooleanFlag(body.improved);
  if (improved === null) return { error: 'improved must be a boolean' };

  return {
    value: {
      project_name: projectName,
      prompt_title: promptTitle,
      prompt_version: text(body.prompt_version),
      prompt_text: promptText,
      response_summary: text(body.response_summary),
      category: text(body.category),
      usefulness: text(body.usefulness),
      reviewed,
      improved,
      screenshot_url: text(body.screenshot_url),
      notes,
    },
  };
}

// Route parameters are strings; only positive integers can identify a row.
function parseId(rawId) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

module.exports = { validateCapsule, parseId };
