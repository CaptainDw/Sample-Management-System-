const { randomUUID } = require('crypto');

function registerBoardLendingApi(app, db, requireAdmin) {
  db.exec(`CREATE TABLE IF NOT EXISTS boardBorrowRecords (
    id TEXT PRIMARY KEY, boardId TEXT NOT NULL, borrowerId TEXT NOT NULL, borrowerName TEXT NOT NULL,
    borrowDate TEXT NOT NULL, expectedReturnDate TEXT NOT NULL, actualReturnDate TEXT, borrowReason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', createdAt TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE UNIQUE INDEX IF NOT EXISTS board_active_loan ON boardBorrowRecords(boardId)
      WHERE status IN ('pending','borrowed','return_pending','return_rejected');
    CREATE TABLE IF NOT EXISTS boardApprovals (id TEXT PRIMARY KEY, recordId TEXT NOT NULL, recordType TEXT NOT NULL,
      status TEXT DEFAULT 'pending', approver TEXT, comment TEXT, approvalDate TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP);`);
  function user(req, res, next) {
    req.boardUser = db.prepare('SELECT id, username, role, status FROM users WHERE id = ?').get(req.body?.userId || req.query.userId || '');
    if (!req.boardUser || req.boardUser.status !== 'approved') return res.status(401).json({success:false,message:'请使用已审核账号登录'});
    next();
  }
  const fail = (res, message, status = 400) => res.status(status).json({success:false,message});
  const dateValid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  const recordsQuery = `SELECT r.*, b.productName, b.projectModel AS productModel, b.serialNumber AS productCode FROM boardBorrowRecords r LEFT JOIN boards b ON b.id = r.boardId`;
  app.get('/api/board-borrow-records', user, (req,res) => {
    const records = req.boardUser.role === 'admin' ? db.prepare(recordsQuery + ' ORDER BY r.createdAt DESC').all() : db.prepare(recordsQuery + ' WHERE r.borrowerId = ? ORDER BY r.createdAt DESC').all(req.boardUser.id);
    res.json({success:true,records});
  });
  app.post('/api/board-borrow-records', user, (req,res) => {
    const {boardId, borrowDate, expectedReturnDate, borrowReason} = req.body;
    if (!dateValid(borrowDate) || !dateValid(expectedReturnDate) || expectedReturnDate < borrowDate || !String(borrowReason || '').trim()) return fail(res,'请填写有效借用日期、预计归还日期和借用原因，归还日期不能早于借用日期');
    if (!db.prepare('SELECT id FROM boards WHERE id = ?').get(boardId || '')) return fail(res,'板卡不存在',404);
    if (db.prepare("SELECT id FROM boardBorrowRecords WHERE boardId = ? AND status IN ('pending','borrowed','return_pending','return_rejected')").get(boardId)) return fail(res,'该板卡已有未完成的借用记录',409);
    const id = randomUUID();
    db.transaction(() => {
      db.prepare('INSERT INTO boardBorrowRecords (id,boardId,borrowerId,borrowerName,borrowDate,expectedReturnDate,borrowReason) VALUES (?,?,?,?,?,?,?)').run(id,boardId,req.boardUser.id,req.boardUser.username,borrowDate,expectedReturnDate,String(borrowReason).trim());
      db.prepare("INSERT INTO boardApprovals (id,recordId,recordType) VALUES (?,?,'borrow')").run(randomUUID(),id);
    })();
    res.json({success:true,id,message:'借出申请已提交，请等待管理员审批'});
  });
  app.post('/api/board-return-request', user, (req,res) => {
    const record = db.prepare('SELECT * FROM boardBorrowRecords WHERE id = ?').get(req.body.recordId || '');
    if (!record) return fail(res,'借用记录不存在',404);
    if (record.borrowerId !== req.boardUser.id) return fail(res,'只能归还本人借用的板卡',403);
    if (!['borrowed','return_rejected'].includes(record.status)) return fail(res,'当前状态不能申请归还',409);
    if (!dateValid(req.body.actualReturnDate) || req.body.actualReturnDate < record.borrowDate) return fail(res,'归还日期无效或早于借用日期');
    db.transaction(() => {
      db.prepare("UPDATE boardBorrowRecords SET status = 'return_pending', actualReturnDate = ? WHERE id = ?").run(req.body.actualReturnDate,record.id);
      db.prepare("INSERT INTO boardApprovals (id,recordId,recordType) VALUES (?,?,'return')").run(randomUUID(),record.id);
    })();
    res.json({success:true});
  });
  app.get('/api/board-approvals', user, requireAdmin, (req,res) => {
    const approvals = db.prepare(`SELECT a.*, r.borrowerName,r.borrowDate,r.expectedReturnDate,r.actualReturnDate,r.borrowReason,b.productName,b.projectModel AS productModel,b.serialNumber AS productCode
      FROM boardApprovals a JOIN boardBorrowRecords r ON r.id=a.recordId LEFT JOIN boards b ON b.id=r.boardId WHERE a.status='pending' ORDER BY a.createdAt DESC`).all();
    res.json({success:true,approvals});
  });
  for (const decision of ['approve','reject']) app.post(`/api/board-approvals/:id/${decision}`, user, requireAdmin, (req,res) => {
    const approval = db.prepare('SELECT * FROM boardApprovals WHERE id = ?').get(req.params.id);
    if (!approval) return fail(res,'审批记录不存在',404);
    if (approval.status !== 'pending') return fail(res,'该审批已处理',409);
    const status = approval.recordType === 'borrow' ? (decision === 'approve' ? 'borrowed' : 'rejected') : (decision === 'approve' ? 'returned' : 'return_rejected');
    db.transaction(() => {
      db.prepare("UPDATE boardApprovals SET status=?,approver=?,comment=?,approvalDate=datetime('now','localtime') WHERE id=?").run(decision === 'approve' ? 'approved' : 'rejected',req.boardUser.username,String(req.body.comment || ''),approval.id);
      db.prepare('UPDATE boardBorrowRecords SET status=? WHERE id=?').run(status,approval.recordId);
    })();
    res.json({success:true});
  });
};


module.exports = registerBoardLendingApi;
