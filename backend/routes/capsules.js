// CRUD for the authenticated user's own capsule records.
//
// The router is mounted behind requireAuth, so req.user.id is always present and
// always came from a verified JWT. Ownership is enforced in the SQL itself -
// every statement is scoped by user_id - so there is no path that can read or
// modify another user's record.

const express = require('express');
const { run, get, all } = require('../db');
const { validateCapsule, parseId } = require('../validation');

const COLUMNS = [
  'project_name',
  'prompt_title',
  'prompt_version',
  'prompt_text',
  'response_summary',
  'category',
  'usefulness',
  'reviewed',
  'improved',
  'screenshot_url',
  'notes',
];

module.exports = function capsulesRouter({ db }) {
  const router = express.Router();

  // GET /api/capsules - the authenticated user's records, newest first.
  router.get('/', async (req, res, next) => {
    try {
      const rows = await all(
        db,
        'SELECT * FROM capsules WHERE user_id = ? ORDER BY id DESC',
        [req.user.id]
      );
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/capsules - create a record owned by the authenticated user.
  router.post('/', async (req, res, next) => {
    try {
      const result = validateCapsule(req.body);
      if (result.error) return res.status(400).json({ error: result.error });

      const capsule = result.value;

      // user_id comes from the verified JWT, never from req.body.
      const info = await run(
        db,
        `INSERT INTO capsules (user_id, ${COLUMNS.join(', ')})
         VALUES (?, ${COLUMNS.map(() => '?').join(', ')})`,
        [req.user.id, ...COLUMNS.map((column) => capsule[column])]
      );

      const created = await get(
        db,
        'SELECT * FROM capsules WHERE id = ? AND user_id = ?',
        [info.lastID, req.user.id]
      );

      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/capsules/:id - update one of the user's own records.
  router.put('/:id', async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) return res.status(404).json({ error: 'Capsule not found' });

      // Scoped lookup: another user's id looks exactly like a missing id.
      const existing = await get(
        db,
        'SELECT id FROM capsules WHERE id = ? AND user_id = ?',
        [id, req.user.id]
      );
      if (!existing) return res.status(404).json({ error: 'Capsule not found' });

      const result = validateCapsule(req.body);
      if (result.error) return res.status(400).json({ error: result.error });

      const capsule = result.value;

      await run(
        db,
        `UPDATE capsules SET ${COLUMNS.map((column) => `${column} = ?`).join(', ')}
         WHERE id = ? AND user_id = ?`,
        [...COLUMNS.map((column) => capsule[column]), id, req.user.id]
      );

      const updated = await get(
        db,
        'SELECT * FROM capsules WHERE id = ? AND user_id = ?',
        [id, req.user.id]
      );

      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/capsules/:id - delete one of the user's own records.
  router.delete('/:id', async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) return res.status(404).json({ error: 'Capsule not found' });

      const info = await run(
        db,
        'DELETE FROM capsules WHERE id = ? AND user_id = ?',
        [id, req.user.id]
      );

      // changes === 0 means the row does not exist *for this user*.
      if (info.changes === 0) return res.status(404).json({ error: 'Capsule not found' });

      res.json({ deleted: true, id });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
