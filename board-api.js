const { randomUUID } = require('crypto');
const registerBoardLendingApi = require('./board-lending-api');

function registerBoardApi(app, db, requireAdmin) {
  const fields = ['productName', 'projectModel', 'batch', 'serialNumber', 'status', 'department', 'responsiblePerson', 'matchedMachine', 'weldingDate', 'coatingDate', 'coatingReturnDate', 'processCard', 'notes'];
  db.exec(`CREATE TABLE IF NOT EXISTS boards (id TEXT PRIMARY KEY, ${fields.map(key => `${key} TEXT NOT NULL DEFAULT ''`).join(', ')}, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)`);
  if (!db.prepare('PRAGMA table_info(boards)').all().some(column => column.name === 'department')) {
    db.exec("ALTER TABLE boards ADD COLUMN department TEXT NOT NULL DEFAULT ''");
  }
  registerBoardLendingApi(app, db, requireAdmin);
  function values(body) {
    const result = fields.map(key => String(body[key] ?? '').trim());
    if (!result[0]) throw new Error('产品名称不能为空');
    for (const key of ['weldingDate', 'coatingDate', 'coatingReturnDate']) {
      const value = result[fields.indexOf(key)];
      if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error('交接日期格式应为有效的 YYYY-MM-DD 日期');
    }
    return result;
  }
  app.get('/api/boards', (req, res) => {
    res.json({ success: true, boards: db.prepare(`SELECT b.*, (SELECT r.status FROM boardBorrowRecords r WHERE r.boardId=b.id AND r.status IN ('pending','borrowed','return_pending','return_rejected') LIMIT 1) AS borrowStatus FROM boards b ORDER BY b.createdAt DESC, b.rowid DESC`).all() });
  });
  app.post('/api/boards', requireAdmin, (req, res) => {
    let data;
    try { data = values(req.body); } catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    const id = randomUUID();
    db.prepare(`INSERT INTO boards (id, ${fields.join(',')}) VALUES (${Array(fields.length + 1).fill('?').join(',')})`).run(id, ...data);
    res.json({ success: true, id });
  });
  app.put('/api/boards/:id', requireAdmin, (req, res) => {
    let data;
    try { data = values(req.body); } catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    const result = db.prepare(`UPDATE boards SET ${fields.map(key => `${key} = ?`).join(',')} WHERE id = ?`).run(...data, req.params.id);
    if (!result.changes) return res.status(404).json({ success: false, message: '板卡不存在' });
    res.json({ success: true });
  });
  app.post('/api/boards/batch-delete', requireAdmin, (req, res) => {
    const ids = req.body.ids;
    if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string')) return res.status(400).json({ success: false, message: '请选择要删除的板卡' });
    if (ids.some(id => db.prepare("SELECT id FROM boardBorrowRecords WHERE boardId=? AND status IN ('pending','borrowed','return_pending','return_rejected')").get(id))) return res.status(409).json({success:false,message:'所选板卡存在未完成的借用记录，不能删除'});
    const remove = db.prepare('DELETE FROM boards WHERE id = ?');
    const deleted = db.transaction(() => ids.reduce((count, id) => count + remove.run(id).changes, 0))();
    res.json({ success: true, deleted });
  });
  app.delete('/api/boards/:id', requireAdmin, (req, res) => {
    if (db.prepare("SELECT id FROM boardBorrowRecords WHERE boardId=? AND status IN ('pending','borrowed','return_pending','return_rejected')").get(req.params.id)) return res.status(409).json({success:false,message:'板卡存在未完成的借用记录，不能删除'});
    if (!db.prepare('DELETE FROM boards WHERE id = ?').run(req.params.id).changes) return res.status(404).json({ success: false, message: '板卡不存在' });
    res.json({ success: true });
  });
};



module.exports = registerBoardApi;
