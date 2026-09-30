const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const registerBoardApi = require('./board-api');

// 创建Express应用
const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
// 前端资源由静态文件中间件提供。
// 局域网部署时避免浏览器继续使用重启前缓存的 HTML/脚本，确保登录流程使用当前版本。
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '研发样品管理系统.html')));
app.use(express.static(path.join(__dirname, '.')));

// 连接SQLite数据库
const db = new Database('./sample_management.db');
console.log('成功连接到SQLite数据库');
// 初始化数据库
initDatabase();

// 错误处理
process.on('SIGINT', () => {
  db.close();
  console.log('数据库连接已关闭');
  process.exit(0);
});

// 初始化数据库表
function initDatabase() {
  try {
    // 初始化数据库
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'pending',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`).run();

    // 样品表 - 使用 CREATE TABLE IF NOT EXISTS 避免删除已有数据
    db.prepare(`CREATE TABLE IF NOT EXISTS samples (
      id TEXT PRIMARY KEY,
      machineName TEXT NOT NULL,
      productModel TEXT NOT NULL,
      productName TEXT NOT NULL,
      productionBatch TEXT,
      productCode TEXT NOT NULL UNIQUE,
      pcbCode TEXT,
      productFunction TEXT,
      physicalLocation TEXT,
      rdManager TEXT,
      managementMethod TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'available'
    )`).run();
    
    // 检查并添加新列（如果不存在）
    try {
      const columns = db.prepare(`PRAGMA table_info(samples)`).all();
      const columnNames = columns.map(col => col.name);
      
      if (!columnNames.includes('projectNumber')) {
        db.prepare(`ALTER TABLE samples ADD COLUMN projectNumber TEXT`).run();
        console.log('添加列 projectNumber 成功');
      }
      if (!columnNames.includes('genericOrSpecific')) {
        db.prepare(`ALTER TABLE samples ADD COLUMN genericOrSpecific TEXT`).run();
        console.log('添加列 genericOrSpecific 成功');
      }
      if (!columnNames.includes('acquisitionMethod')) {
        db.prepare(`ALTER TABLE samples ADD COLUMN acquisitionMethod TEXT`).run();
        console.log('添加列 acquisitionMethod 成功');
      }
      if (!columnNames.includes('accountingSubject')) {
        db.prepare(`ALTER TABLE samples ADD COLUMN accountingSubject TEXT`).run();
        console.log('添加列 accountingSubject 成功');
      }
    } catch (err) {
      console.error('更新表结构失败:', err.message);
    }

    // 借用记录表
    db.prepare(`CREATE TABLE IF NOT EXISTS borrowRecords (
      id TEXT PRIMARY KEY,
      sampleId TEXT NOT NULL,
      borrowerName TEXT NOT NULL,
      borrowDate TEXT NOT NULL,
      expectedReturnDate TEXT,
      actualReturnDate TEXT,
      borrowReason TEXT,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY (sampleId) REFERENCES samples(id)
    )`).run();

    // 审批记录表
    db.prepare(`CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      recordId TEXT NOT NULL,
      recordType TEXT NOT NULL,
      approver TEXT,
      approvalDate TEXT,
      status TEXT DEFAULT 'pending',
      comment TEXT,
      FOREIGN KEY (recordId) REFERENCES borrowRecords(id)
    )`).run();

    // 资产表（笔记本电脑设备）
    db.prepare(`CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      model TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      user TEXT,
      notes TEXT,
      status TEXT DEFAULT 'available',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`).run();

    // 资产借出相关字段（使用ALTER TABLE ADD COLUMN避免数据丢失）
    try { db.prepare(`ALTER TABLE assets ADD COLUMN borrowDate TEXT`).run(); } catch (e) { /* 列已存在 */ }
    try { db.prepare(`ALTER TABLE assets ADD COLUMN expectedReturnDate TEXT`).run(); } catch (e) { /* 列已存在 */ }
    try { db.prepare(`ALTER TABLE assets ADD COLUMN borrowReason TEXT`).run(); } catch (e) { /* 列已存在 */ }

    // 资产扩展字段（使用ALTER TABLE ADD COLUMN避免数据丢失）
    try { db.prepare(`ALTER TABLE assets ADD COLUMN name TEXT`).run(); } catch (e) { /* 列已存在 */ }
    try { db.prepare(`ALTER TABLE assets ADD COLUMN classification TEXT`).run(); } catch (e) { /* 列已存在 */ }
    try { db.prepare(`ALTER TABLE assets ADD COLUMN systemName TEXT`).run(); } catch (e) { /* 列已存在 */ }
    try { db.prepare(`ALTER TABLE assets ADD COLUMN systemInstallDate TEXT`).run(); } catch (e) { /* 列已存在 */ }
    try { db.prepare(`ALTER TABLE assets ADD COLUMN diskSerial TEXT`).run(); } catch (e) { /* 列已存在 */ }
    try { db.prepare(`ALTER TABLE assets ADD COLUMN bootTime TEXT`).run(); } catch (e) { /* 列已存在 */ }
    try { db.prepare(`ALTER TABLE assets ADD COLUMN deviceSerial TEXT`).run(); } catch (e) { /* 列已存在 */ }
    try { db.prepare(`ALTER TABLE assets ADD COLUMN ipAddress TEXT`).run(); } catch (e) { /* 列已存在 */ }
    try { db.prepare(`ALTER TABLE assets ADD COLUMN macAddress TEXT`).run(); } catch (e) { /* 列已存在 */ }

    // 资产借用记录表（与样品borrowRecords结构一致，走审批流程）
    db.prepare(`CREATE TABLE IF NOT EXISTS assetBorrowRecords (
      id TEXT PRIMARY KEY,
      assetId TEXT NOT NULL,
      borrowerName TEXT NOT NULL,
      borrowDate TEXT NOT NULL,
      expectedReturnDate TEXT,
      actualReturnDate TEXT,
      borrowReason TEXT,
      status TEXT DEFAULT 'pending',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assetId) REFERENCES assets(id)
    )`).run();

    // 资产审批记录表（与样品approvals结构一致）
    db.prepare(`CREATE TABLE IF NOT EXISTS assetApprovals (
      id TEXT PRIMARY KEY,
      recordId TEXT NOT NULL,
      recordType TEXT NOT NULL,
      approver TEXT,
      approvalDate TEXT,
      status TEXT DEFAULT 'pending',
      comment TEXT,
      FOREIGN KEY (recordId) REFERENCES assetBorrowRecords(id)
    )`).run();

    // 工装管理表
    db.prepare(`CREATE TABLE IF NOT EXISTS tooling (
      id TEXT PRIMARY KEY,
      category TEXT,
      name TEXT NOT NULL,
      model TEXT,
      deviceCode TEXT NOT NULL UNIQUE,
      responsiblePerson TEXT,
      manufacturer TEXT,
      serialNumber TEXT,
      usageScope TEXT,
      loginDate TEXT,
      deviceStatus TEXT DEFAULT '正常',
      usageStatus TEXT DEFAULT '在用',
      amount REAL,
      channel TEXT,
      notes TEXT,
      status TEXT DEFAULT 'available',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`).run();

    // 工装借用记录表
    db.prepare(`CREATE TABLE IF NOT EXISTS toolingBorrowRecords (
      id TEXT PRIMARY KEY,
      toolingId TEXT NOT NULL,
      borrowerName TEXT NOT NULL,
      borrowDate TEXT NOT NULL,
      expectedReturnDate TEXT,
      actualReturnDate TEXT,
      borrowReason TEXT,
      status TEXT DEFAULT 'pending',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`).run();

    // 工装审批记录表
    db.prepare(`CREATE TABLE IF NOT EXISTS toolingApprovals (
      id TEXT PRIMARY KEY,
      recordId TEXT NOT NULL,
      recordType TEXT NOT NULL,
      approver TEXT,
      approvalDate TEXT,
      status TEXT DEFAULT 'pending',
      comment TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`).run();
    // 确保 toolingApprovals 表存在 createdAt 列（已建表时补加）
    try {
      const toolingApprovalCols = db.prepare(`PRAGMA table_info(toolingApprovals)`).all();
      const toolingApprovalColNames = toolingApprovalCols.map(col => col.name);
      if (!toolingApprovalColNames.includes('createdAt')) {
        db.prepare(`ALTER TABLE toolingApprovals ADD COLUMN createdAt TEXT DEFAULT CURRENT_TIMESTAMP`).run();
        console.log('添加列 toolingApprovals.createdAt 成功');
      }
    } catch (err) {
      console.error('更新 toolingApprovals 表结构失败:', err.message);
    }

    // 添加默认管理员用户
    const row = db.prepare(`SELECT * FROM users WHERE username = 'admin'`).get();
    if (!row) {
      const adminId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      db.prepare(
        `INSERT INTO users (id, username, password, role, phone, status) VALUES (?, ?, ?, ?, ?, ?)`
      ).run([adminId, 'admin', 'admin', 'admin', '13800138000', 'approved']);
      console.log('默认管理员用户创建成功: 用户名admin, 密码admin');
    }
    
    // 添加初始样数据
    const sampleCount = db.prepare(`SELECT COUNT(*) as count FROM samples`).get().count;
    if (sampleCount === 0) {
      const sample1Id = Date.now().toString(36) + Math.random().toString(36).substr(2);
      const sample2Id = Date.now().toString(36) + Math.random().toString(36).substr(2);
      const sample3Id = Date.now().toString(36) + Math.random().toString(36).substr(2);
      
      db.prepare(
        `INSERT INTO samples (id, machineName, projectNumber, productModel, productName, genericOrSpecific, productionBatch, productCode, pcbCode, productFunction, physicalLocation, rdManager, acquisitionMethod, managementMethod, accountingSubject, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run([sample1Id, 'A系列', 'RD-2024-001', 'A100', '智能手环', '通用', '202301', 'SH-001', 'PCB-A100-V1', '心率监测, 计步', '研发部柜1层', '张三', '自制', '研发样品', '直接投入', '第一批测试样品', 'available']);
      
      db.prepare(
        `INSERT INTO samples (id, machineName, projectNumber, productModel, productName, genericOrSpecific, productionBatch, productCode, pcbCode, productFunction, physicalLocation, rdManager, acquisitionMethod, managementMethod, accountingSubject, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run([sample2Id, 'B系列', 'RD-2024-002', 'B200', '无线耳机', '专用', '202302', 'ER-002', 'PCB-B200-V2', '蓝牙5.0, 降噪', '研发部柜2层', '李四', '外购', '固定资产', '固定资产', '用于展会展示', 'available']);
      
      db.prepare(
        `INSERT INTO samples (id, machineName, projectNumber, productModel, productName, genericOrSpecific, productionBatch, productCode, pcbCode, productFunction, physicalLocation, rdManager, acquisitionMethod, managementMethod, accountingSubject, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run([sample3Id, 'C系列', 'RD-2024-003', 'C300', '智能音箱', '通用', '202303', 'SP-003', 'PCB-C300-V1', '语音助手, 智能家居控制', '报废区', '王五', '自制', '报废', '直接投入', '测试失败，已报废', 'available']);
      
      console.log('初始样数据添加成功');
    }

    // 添加初始工装数据（仅当 tooling 表为空时）
    const toolingCount = db.prepare(`SELECT COUNT(*) as count FROM tooling`).get().count;
    if (toolingCount === 0) {
      const tool1Id = generateUniqueId();
      const tool2Id = generateUniqueId();
      const tool3Id = generateUniqueId();
      db.prepare(
        `INSERT INTO tooling (id, category, name, model, deviceCode, responsiblePerson, manufacturer, serialNumber, usageScope, loginDate, deviceStatus, usageStatus, amount, channel, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')`
      ).run([tool1Id, '刀具', '数控车刀', 'CNMG-120404', 'GZ-001', '张三', '山特维克(瑞典)', 'SN-2024-001', '数控车床加工', '2024-03-15', '正常', '在用', 350.00, '外购', '通用车削刀具', 'available']);
      db.prepare(
        `INSERT INTO tooling (id, category, name, model, deviceCode, responsiblePerson, manufacturer, serialNumber, usageScope, loginDate, deviceStatus, usageStatus, amount, channel, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')`
      ).run([tool2Id, '量具', '游标卡尺', '0-150mm', 'GZ-002', '李四', '三丰(日本)', 'SN-2024-002', '精密测量', '2024-04-20', '正常', '在用', 280.00, '外购', '精度0.02mm', 'available']);
      db.prepare(
        `INSERT INTO tooling (id, category, name, model, deviceCode, responsiblePerson, manufacturer, serialNumber, usageScope, loginDate, deviceStatus, usageStatus, amount, channel, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')`
      ).run([tool3Id, '夹具', '平口钳', 'QC-125', 'GZ-003', '王五', '哈尔滨量具(中国)', 'SN-2024-003', '铣床夹持', '2024-05-10', '正常', '闲置', 1200.00, '外购', '高精度平口钳', 'available']);
      console.log('初始工装数据添加成功');
    }
  } catch (err) {
    console.error('数据库初始化错误:', err.message);
  }
}

// 生成唯一ID
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// API路由

// 登录
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  console.log('接收到登录请求:', { username, password });

  try {
    // 先查询是否存在该用户名
    const userByUsername = db.prepare(`SELECT * FROM users WHERE username = ?`).get([username]);
    console.log('根据用户名查询结果:', userByUsername);

    if (!userByUsername) {
      return res.status(401).json({ success: false, message: '用户名不存在' });
    }

    // 检查账户状态
    if (userByUsername.status === 'pending') {
      return res.status(401).json({ success: false, message: '账户待审批，请等待管理员审核' });
    }
    
    if (userByUsername.status === 'rejected') {
      return res.status(401).json({ success: false, message: '账户已被拒绝，请联系管理员' });
    }

    // 再检查密码是否匹配
    const row = db.prepare(`SELECT * FROM users WHERE username = ? AND password = ?`).get([username, password]);
    console.log('用户名和密码匹配结果:', row);

    if (!row) {
      return res.status(401).json({ success: false, message: '密码错误' });
    }

    const user = {
      id: row.id,
      username: row.username,
      role: row.role,
      phone: row.phone,
      status: row.status
    };

    res.json({ success: true, message: '登录成功', user });
  } catch (err) {
    console.error('登录错误:', err);
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 注册
app.post('/api/register', (req, res) => {
  const { username, password, phone } = req.body;

  if (typeof username !== 'string' || !/^\p{Script=Han}+$/u.test(username)) {
    return res.status(400).json({ success: false, message: '用户名必须全部为中文汉字，不能包含英文字母、拼音、数字、空格或符号' });
  }

  try {
    // 检查用户名是否已存在（包括待审批状态）
    const userRow = db.prepare(`SELECT * FROM users WHERE username = ?`).get([username]);
    if (userRow) {
      return res.status(400).json({ success: false, message: '用户名已存在' });
    }

    // 检查手机号是否已存在（包括待审批状态）
    const phoneRow = db.prepare(`SELECT * FROM users WHERE phone = ?`).get([phone]);
    if (phoneRow) {
      return res.status(400).json({ success: false, message: '手机号已被注册' });
    }

    // 创建新用户（待审批状态）
    const userId = generateUniqueId();
    const createdAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, username, password, role, phone, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run([userId, username, password, 'user', phone, 'pending', createdAt]);

    // 注意：注册审批直接查询users表，不需要创建审批记录

    res.json({ success: true, message: '注册申请已提交，请等待管理员审批' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 修改密码
app.post('/api/change-password', (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;

  try {
    const row = db.prepare(`SELECT * FROM users WHERE id = ? AND password = ?`).get([userId, oldPassword]);

    if (!row) {
      return res.status(401).json({ success: false, message: '旧密码不正确' });
    }

    db.prepare(`UPDATE users SET password = ? WHERE id = ?`).run([newPassword, userId]);

    res.json({ success: true, message: '密码修改成功' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 忘记密码重置：通过用户名和已验证手机号更新后端数据库密码。
app.post('/api/reset-password', (req, res) => {
  const { username, phone, newPassword } = req.body;
  if (!username || !phone || !newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ success: false, message: '用户名、手机号和新密码不能为空，密码至少需要6位' });
  }
  try {
    const row = db.prepare(`SELECT id FROM users WHERE username = ? AND phone = ?`).get([username, phone]);
    if (!row) return res.status(404).json({ success: false, message: '用户名或手机号不匹配' });
    db.prepare(`UPDATE users SET password = ? WHERE id = ?`).run([newPassword, row.id]);
    res.json({ success: true, message: '密码重置成功，请使用新密码登录' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 获取所有样品
app.get('/api/samples', (req, res) => {
  const { machineName, productName, productModel } = req.query;
  let query = `SELECT * FROM samples WHERE 1=1`;
  const params = [];

  if (machineName) {
    query += ` AND machineName LIKE ?`;
    params.push(`%${machineName}%`);
  }

  if (productName) {
    query += ` AND productName LIKE ?`;
    params.push(`%${productName}%`);
  }

  if (productModel) {
    query += ` AND productModel LIKE ?`;
    params.push(`%${productModel}%`);
  }

  try {
    const rows = db.prepare(query).all(params);
    res.json({ success: true, samples: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 获取单个样品
app.get('/api/samples/:id', (req, res) => {
  const { id } = req.params;

  try {
    const row = db.prepare(`SELECT * FROM samples WHERE id = ?`).get([id]);
    if (!row) {
      return res.status(404).json({ success: false, message: '样品不存在' });
    }
    res.json({ success: true, sample: row });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 添加样品
app.post('/api/samples', (req, res) => {
  const { machineName, projectNumber, productModel, productName, genericOrSpecific, productionBatch, productCode, pcbCode, productFunction, physicalLocation, rdManager, acquisitionMethod, managementMethod, accountingSubject, notes } = req.body;

  try {
    // 检查产品编码是否已存在
    const row = db.prepare(`SELECT * FROM samples WHERE productCode = ?`).get([productCode]);
    if (row) {
      return res.status(400).json({ success: false, message: '产品编码已存在' });
    }

    const sampleId = generateUniqueId();
    db.prepare(
      `INSERT INTO samples (id, machineName, projectNumber, productModel, productName, genericOrSpecific, productionBatch, productCode, pcbCode, productFunction, physicalLocation, rdManager, acquisitionMethod, managementMethod, accountingSubject, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run([sampleId, machineName, projectNumber, productModel, productName, genericOrSpecific, productionBatch, productCode, pcbCode, productFunction, physicalLocation, rdManager, acquisitionMethod, managementMethod, accountingSubject, notes]);

    res.json({ success: true, message: '样品添加成功', sampleId });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 更新样品
app.put('/api/samples/:id', (req, res) => {
  const { id } = req.params;
  const { machineName, projectNumber, productModel, productName, genericOrSpecific, productionBatch, productCode, pcbCode, productFunction, physicalLocation, rdManager, acquisitionMethod, managementMethod, accountingSubject, notes } = req.body;

  try {
    // 检查样品是否存在
    const sampleRow = db.prepare(`SELECT * FROM samples WHERE id = ?`).get([id]);
    if (!sampleRow) {
      return res.status(404).json({ success: false, message: '样品不存在' });
    }

    // 检查产品编码是否已被其他样品使用
    const codeRow = db.prepare(`SELECT * FROM samples WHERE productCode = ? AND id != ?`).get([productCode, id]);
    if (codeRow) {
      return res.status(400).json({ success: false, message: '产品编码已被其他样品使用' });
    }

    db.prepare(
      `UPDATE samples SET machineName = ?, projectNumber = ?, productModel = ?, productName = ?, genericOrSpecific = ?, productionBatch = ?, productCode = ?, pcbCode = ?, productFunction = ?, physicalLocation = ?, rdManager = ?, acquisitionMethod = ?, managementMethod = ?, accountingSubject = ?, notes = ? WHERE id = ?`
    ).run([machineName, projectNumber, productModel, productName, genericOrSpecific, productionBatch, productCode, pcbCode, productFunction, physicalLocation, rdManager, acquisitionMethod, managementMethod, accountingSubject, notes, id]);

    res.json({ success: true, message: '样品更新成功' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 删除样品
app.delete('/api/samples/:id', (req, res) => {
  const { id } = req.params;

  try {
    // 检查样品是否存在
    const sampleRow = db.prepare(`SELECT * FROM samples WHERE id = ?`).get([id]);
    if (!sampleRow) {
      return res.status(404).json({ success: false, message: '样品不存在' });
    }

    // 检查样品是否有未完成的借用记录
    const borrowRow = db.prepare(`SELECT * FROM borrowRecords WHERE sampleId = ? AND status NOT IN ('returned', 'rejected') AND status NOT LIKE '%归还被拒绝%'`).get([id]);
    if (borrowRow) {
      return res.status(400).json({ success: false, message: '该样品存在未完成的借用记录，无法删除。请先处理相关的借用归还申请。' });
    }

    // 删除相关的审批记录
    db.prepare(`DELETE FROM approvals WHERE recordId IN (SELECT id FROM borrowRecords WHERE sampleId = ?)`).run([id]);
    
    // 删除相关的借用记录（已归还/已拒绝的记录）
    db.prepare(`DELETE FROM borrowRecords WHERE sampleId = ?`).run([id]);
    
    // 最后删除样品
    db.prepare(`DELETE FROM samples WHERE id = ?`).run([id]);

    res.json({ success: true, message: '样品删除成功' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 创建借用申请
app.post('/api/borrow-records', (req, res) => {
  const { sampleId, borrowerName, borrowDate, expectedReturnDate, borrowReason } = req.body;

  try {
    // 检查样品是否存在
    const sampleRow = db.prepare(`SELECT * FROM samples WHERE id = ?`).get([sampleId]);
    if (!sampleRow) {
      return res.status(404).json({ success: false, message: '样品不存在' });
    }

    // 检查样品是否可借用
    if (sampleRow.status !== 'available') {
      return res.status(400).json({ success: false, message: '样品当前不可借用' });
    }

    const recordId = generateUniqueId();
    db.prepare(
      `INSERT INTO borrowRecords (id, sampleId, borrowerName, borrowDate, expectedReturnDate, borrowReason, status) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run([recordId, sampleId, borrowerName, borrowDate, expectedReturnDate, borrowReason, 'pending']);

    // 创建审批记录
    const approvalId = generateUniqueId();
    db.prepare(
      `INSERT INTO approvals (id, recordId, recordType, status) VALUES (?, ?, ?, ?)`
    ).run([approvalId, recordId, 'borrow', 'pending']);

    res.json({ success: true, message: '借用申请已提交，等待审批', recordId });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 获取所有借用记录
app.get('/api/borrow-records', (req, res) => {
  const { machineName, productName, productModel, borrowerName, status } = req.query;
  let query = `SELECT br.*, s.machineName, s.productName, s.productModel FROM borrowRecords br LEFT JOIN samples s ON br.sampleId = s.id WHERE 1=1`;
  const params = [];

  if (machineName) {
    query += ` AND s.machineName LIKE ?`;
    params.push(`%${machineName}%`);
  }

  if (productName) {
    query += ` AND s.productName LIKE ?`;
    params.push(`%${productName}%`);
  }

  if (productModel) {
    query += ` AND s.productModel LIKE ?`;
    params.push(`%${productModel}%`);
  }

  if (borrowerName) {
    query += ` AND br.borrowerName LIKE ?`;
    params.push(`%${borrowerName}%`);
  }

  if (status) {
    query += ` AND br.status = ?`;
    params.push(status);
  }

  try {
    const rows = db.prepare(query).all(params);
    res.json({ success: true, records: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 申请归还样品
app.post('/api/return-request', (req, res) => {
  const { recordId, actualReturnDate } = req.body;

  try {
    // 检查借用记录是否存在
    const borrowRow = db.prepare(`SELECT * FROM borrowRecords WHERE id = ?`).get([recordId]);
    if (!borrowRow) {
      return res.status(404).json({ success: false, message: '借用记录不存在' });
    }

    // 允许借用中、已批准或被拒绝的记录重新申请归还
    const canRequestReturn = borrowRow.status === 'borrowed' || 
                           borrowRow.status === 'approved' || 
                           (borrowRow.status && borrowRow.status.includes('拒绝'));
    
    if (!canRequestReturn) {
      return res.status(400).json({ success: false, message: '该记录当前无法申请归还' });
    }

    // 更新借用记录
    db.prepare(
      `UPDATE borrowRecords SET actualReturnDate = ?, status = ? WHERE id = ?`
    ).run([actualReturnDate, 'return_pending', recordId]);

    // 创建归还审批记录
    const approvalId = generateUniqueId();
    db.prepare(
      `INSERT INTO approvals (id, recordId, recordType, status) VALUES (?, ?, ?, ?)`
    ).run([approvalId, recordId, 'return', 'pending']);

    res.json({ success: true, message: '归还申请已提交，等待审批' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 获取所有审批记录
app.get('/api/approvals', (req, res) => {
  const { type, status } = req.query;
  let query = '';
  const params = [];

  if (type === 'register') {
    // 用户注册审批 - 直接从users表查询待审批用户
    query = `SELECT id as approvalId, id as recordId, 'registration' as recordType, status, '' as approver, '' as approvalDate, '' as comment, username, phone, createdAt as registerDate FROM users WHERE status = 'pending'`;
  } else {
    // 借用和归还审批
    query = `SELECT a.id as approvalId, a.recordId, a.recordType, a.status, a.approver, a.approvalDate, a.comment, br.borrowerName, br.borrowDate, br.expectedReturnDate, br.actualReturnDate, br.borrowReason as purpose, s.machineName, s.productName, s.productModel, s.productCode FROM approvals a LEFT JOIN borrowRecords br ON a.recordId = br.id LEFT JOIN samples s ON br.sampleId = s.id WHERE 1=1`;
  }

  if (type && type !== 'register') {
    query += ` AND a.recordType = ?`;
    params.push(type);
  }

  if (status && type !== 'register') {
    query += ` AND a.status = ?`;
    params.push(status);
  }

  try {
    const rows = db.prepare(query).all(params);
    
    // 重命名approvalId为id，保持API兼容性
    const approvals = rows.map(row => ({
      id: row.approvalId,
      recordId: row.recordId,
      recordType: row.recordType,
      status: row.status,
      approver: row.approver,
      approvalDate: row.approvalDate,
      comment: row.comment,
      borrowerName: row.borrowerName,
      borrowDate: row.borrowDate,
      expectedReturnDate: row.expectedReturnDate,
      actualReturnDate: row.actualReturnDate,
      purpose: row.purpose,
      machineName: row.machineName,
      productName: row.productName,
      productModel: row.productModel,
      productCode: row.productCode,
      username: row.username,
      phone: row.phone,
      registerDate: row.registerDate
    }));
    
    res.json({ success: true, approvals });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 处理审批
app.post('/api/approvals/:id', (req, res) => {
  const { id } = req.params;
  const { status, comment, approver } = req.body;

  try {
    // 检查是否为注册审批（用户ID直接作为审批ID）
    const userRow = db.prepare(`SELECT * FROM users WHERE id = ?`).get([id]);
    
    if (userRow && userRow.status === 'pending') {
      // 注册审批 - 删除用户记录，允许重新注册
      if (status === 'approved') {
        db.prepare(
          `UPDATE users SET status = 'approved' WHERE id = ?`
        ).run([id]);
      } else if (status === 'rejected') {
        // 拒绝注册申请时直接删除用户记录
        db.prepare(
          `DELETE FROM users WHERE id = ?`
        ).run([id]);
      }
      
      res.json({ success: true, message: '注册审批处理成功' });
      return;
    }

    // 原有的借用和归还审批逻辑
    const approvalRow = db.prepare(`SELECT * FROM approvals WHERE id = ?`).get([id]);
    if (!approvalRow) {
      return res.status(404).json({ success: false, message: '审批记录不存在' });
    }

    if (approvalRow.status !== 'pending') {
      return res.status(400).json({ success: false, message: '该审批已处理' });
    }

    // 更新审批记录
    const approvalDate = new Date().toISOString().split('T')[0];
    db.prepare(
      `UPDATE approvals SET status = ?, comment = ?, approver = ?, approvalDate = ? WHERE id = ?`
    ).run([status, comment, approver, approvalDate, id]);

    // 根据审批类型和结果更新相关记录
    if (approvalRow.recordType === 'borrow') {
      if (status === 'approved') {
        // 更新借用记录状态
        db.prepare(`UPDATE borrowRecords SET status = 'borrowed' WHERE id = ?`).run([approvalRow.recordId]);

        // 更新样品状态
        const brRow = db.prepare(`SELECT sampleId FROM borrowRecords WHERE id = ?`).get([approvalRow.recordId]);
        if (brRow) {
          db.prepare(`UPDATE samples SET status = 'borrowed' WHERE id = ?`).run([brRow.sampleId]);
        }
      } else if (status === 'rejected') {
        // 更新借用记录状态
        db.prepare(`UPDATE borrowRecords SET status = 'rejected' WHERE id = ?`).run([approvalRow.recordId]);
      }
    } else if (approvalRow.recordType === 'return') {
      if (status === 'approved') {
        // 更新借用记录状态
        db.prepare(`UPDATE borrowRecords SET status = 'returned' WHERE id = ?`).run([approvalRow.recordId]);

        // 更新样品状态
        const brRow = db.prepare(`SELECT sampleId FROM borrowRecords WHERE id = ?`).get([approvalRow.recordId]);
        if (brRow) {
          db.prepare(`UPDATE samples SET status = 'available' WHERE id = ?`).run([brRow.sampleId]);
        }
      } else if (status === 'rejected') {
        // 更新借用记录状态
        db.prepare(`UPDATE borrowRecords SET status = 'borrowed' WHERE id = ?`).run([approvalRow.recordId]);
      }
    }

    res.json({ success: true, message: '审批处理成功' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 获取所有用户（管理员）
app.get('/api/users', (req, res) => {
  const { username, status } = req.query;
  let query = `SELECT * FROM users WHERE 1=1`;
  const params = [];

  if (username) {
    query += ` AND username LIKE ?`;
    params.push(`%${username}%`);
  }

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  try {
    const rows = db.prepare(query).all(params);
    res.json({ success: true, users: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 添加用户（管理员）
app.post('/api/users', (req, res) => {
  const { username, password, phone, role } = req.body;

  try {
    // 检查用户名是否已存在
    const userByUsername = db.prepare(`SELECT * FROM users WHERE username = ?`).get([username]);
    if (userByUsername) {
      return res.status(400).json({ success: false, message: '用户名已存在' });
    }

    // 检查手机号是否已存在
    const userByPhone = db.prepare(`SELECT * FROM users WHERE phone = ?`).get([phone]);
    if (userByPhone) {
      return res.status(400).json({ success: false, message: '手机号已被注册' });
    }

    const userId = generateUniqueId();
    db.prepare(
      `INSERT INTO users (id, username, password, role, phone, status) VALUES (?, ?, ?, ?, ?, ?)`
    ).run([userId, username, password, role || 'user', phone, 'approved']);

    res.json({ success: true, message: '用户添加成功', userId });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 更新用户（管理员）
app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { username, password, phone, role } = req.body;

  try {
    // 检查用户是否存在
    const existingUser = db.prepare(`SELECT * FROM users WHERE id = ?`).get([id]);
    if (!existingUser) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 检查用户名是否已被其他用户使用
    if (username && username !== existingUser.username) {
      const userWithSameUsername = db.prepare(
        `SELECT * FROM users WHERE username = ? AND id != ?`
      ).get([username, id]);
      if (userWithSameUsername) {
        return res.status(400).json({ success: false, message: '用户名已被其他用户使用' });
      }
    }

    // 检查手机号是否已被其他用户使用
    if (phone && phone !== existingUser.phone) {
      const userWithSamePhone = db.prepare(
        `SELECT * FROM users WHERE phone = ? AND id != ?`
      ).get([phone, id]);
      if (userWithSamePhone) {
        return res.status(400).json({ success: false, message: '手机号已被其他用户使用' });
      }
    }

    // 构建更新语句
    let query = `UPDATE users SET `;
    const params = [];
    let hasSet = false;

    if (username) {
      query += `username = ?, `;
      params.push(username);
      hasSet = true;
    }

    if (password) {
      query += `password = ?, `;
      params.push(password);
      hasSet = true;
    }

    if (phone) {
      query += `phone = ?, `;
      params.push(phone);
      hasSet = true;
    }

    if (role) {
      query += `role = ?, `;
      params.push(role);
      hasSet = true;
    }

    // 移除末尾的逗号和空格
    if (hasSet) {
      query = query.slice(0, -2);
    } else {
      return res.status(400).json({ success: false, message: '至少需要更新一个字段' });
    }

    query += ` WHERE id = ?`;
    params.push(id);

    // 执行更新
    db.prepare(query).run(params);

    res.json({ success: true, message: '用户更新成功' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 删除用户（管理员）
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;

  try {
    // 检查用户是否存在
    const existingUser = db.prepare(`SELECT * FROM users WHERE id = ?`).get([id]);
    if (!existingUser) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 不允许删除最后一个管理员
    if (existingUser.role === 'admin') {
      const adminCountRow = db.prepare(
        `SELECT COUNT(*) as count FROM users WHERE role = 'admin'`
      ).get();
      if (adminCountRow.count <= 1) {
        return res.status(400).json({ success: false, message: '不允许删除最后一个管理员' });
      }
    }

    // 执行删除
    db.prepare(`DELETE FROM users WHERE id = ?`).run([id]);

    res.json({ success: true, message: '用户删除成功' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 获取仪表盘数据
app.get('/api/dashboard', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  try {
    // 总样品数
    const totalSamplesRow = db.prepare(`SELECT COUNT(*) as count FROM samples`).get();

    // 待归还样品数 - 包含借用中和归还被拒绝的样品
    const borrowedSamplesRow = db.prepare(
      `SELECT COUNT(*) as count FROM borrowRecords WHERE status IN ('borrowed', 'return_pending') OR status LIKE '%归还被拒绝%'`
    ).get();

    // 今日样品申请数（借出申请+归还申请）
    const todaySampleApplicationsRow = db.prepare(
      `SELECT COUNT(*) as count FROM borrowRecords WHERE (status = 'pending' AND borrowDate = ?) OR (status = 'return_pending' AND actualReturnDate = ?)`
    ).get([today, today]);

    // 今日资产申请数（借出申请+归还申请）
    const todayAssetApplicationsRow = db.prepare(
      `SELECT COUNT(*) as count FROM assetBorrowRecords WHERE (status = 'pending' AND borrowDate = ?) OR (status = 'return_pending' AND actualReturnDate = ?)`
    ).get([today, today]);

    const todayApplications = (todaySampleApplicationsRow?.count || 0) + (todayAssetApplicationsRow?.count || 0);

    // 报废样品数
    const scrappedSamplesRow = db.prepare(
      `SELECT COUNT(*) as count FROM samples WHERE managementMethod = '报废'`
    ).get();

    // 借用人数量（样品+资产）
    const sampleBorrowersRow = db.prepare(
      `SELECT COUNT(DISTINCT borrowerName) as count FROM borrowRecords`
    ).get();
    const assetBorrowersRow = db.prepare(
      `SELECT COUNT(DISTINCT borrowerName) as count FROM assetBorrowRecords`
    ).get();

    // 样品类型分布
    const sampleTypeDistribution = db.prepare(
      `SELECT managementMethod, COUNT(*) as count FROM samples GROUP BY managementMethod`
    ).all();

    // 借用人样品数量分布
    const borrowerSampleDistribution = db.prepare(
      `SELECT borrowerName, COUNT(*) as count FROM borrowRecords WHERE status IN ('borrowed', 'approved') GROUP BY borrowerName`
    ).all();

    // 机种样品数量分布
    const machineSampleDistribution = db.prepare(
      `SELECT machineName, COUNT(*) as count FROM samples GROUP BY machineName`
    ).all();

    const dashboardData = {
      totalSamples: totalSamplesRow?.count || 0,
      borrowedSamples: borrowedSamplesRow?.count || 0,
      todayApplications: todayApplications,
      scrappedSamples: scrappedSamplesRow?.count || 0,
      borrowerCount: (sampleBorrowersRow?.count || 0) + (assetBorrowersRow?.count || 0),
      sampleTypeDistribution: sampleTypeDistribution || [],
      borrowerSampleDistribution: borrowerSampleDistribution || [],
      machineSampleDistribution: machineSampleDistribution || []
    };

    res.json({ success: true, data: dashboardData });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 批准归还申请
app.post('/api/return-records/:id/approve', (req, res) => {
  const { id } = req.params;
  const today = new Date().toISOString().split('T')[0];

  try {
    // 检查借用记录是否存在
    const record = db.prepare(`SELECT * FROM borrowRecords WHERE id = ?`).get([id]);
    if (!record) {
      return res.status(404).json({ success: false, message: '借用记录不存在' });
    }

    if (record.status !== 'return_pending') {
      return res.status(400).json({ success: false, message: '该记录当前无法批准归还' });
    }

    // 更新借用记录状态
    db.prepare(
      `UPDATE borrowRecords SET status = 'returned', actualReturnDate = ? WHERE id = ?`
    ).run([record.actualReturnDate || today, id]);

    // 更新样品状态为可用
    db.prepare(`UPDATE samples SET status = 'available' WHERE id = ?`).run([record.sampleId]);

    // 更新审批记录状态
    db.prepare(
      `UPDATE approvals SET status = 'approved', approvalDate = ? WHERE recordId = ? AND recordType = 'return'`
    ).run([today, id]);

    res.json({ success: true, message: '归还申请已批准' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 拒绝归还申请
app.post('/api/return-records/:id/reject', (req, res) => {
  const { id } = req.params;

  try {
    // 检查借用记录是否存在
    const record = db.prepare(`SELECT * FROM borrowRecords WHERE id = ?`).get([id]);
    if (!record) {
      return res.status(404).json({ success: false, message: '借用记录不存在' });
    }

    if (record.status !== 'return_pending') {
      return res.status(400).json({ success: false, message: '该记录当前无法拒绝归还' });
    }

    // 更新借用记录状态
    db.prepare(
      `UPDATE borrowRecords SET status = 'borrowed', actualReturnDate = NULL WHERE id = ?`
    ).run([id]);

    // 更新审批记录状态
    const today = new Date().toISOString().split('T')[0];
    db.prepare(
      `UPDATE approvals SET status = 'rejected', approvalDate = ? WHERE recordId = ? AND recordType = 'return'`
    ).run([today, id]);

    res.json({ success: true, message: '归还申请已拒绝' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 批准借出申请
app.post('/api/approvals/:id/approve', (req, res) => {
  const { id } = req.params;
  const { approver } = req.body;

  try {
    // 首先检查是否为注册审批（用户ID直接作为审批ID）
    const userRow = db.prepare(`SELECT * FROM users WHERE id = ?`).get([id]);
    if (userRow && userRow.status === 'pending') {
      // 注册审批 - 直接更新用户状态
      const today = new Date().toISOString().split('T')[0];
      db.prepare(`UPDATE users SET status = 'approved' WHERE id = ?`).run([id]);
      res.json({ success: true, message: '注册申请已批准' });
      return;
    }

    // 原有的审批记录处理逻辑
    const approvalRow = db.prepare(`SELECT * FROM approvals WHERE id = ?`).get([id]);
    if (!approvalRow) {
      return res.status(404).json({ success: false, message: '审批记录不存在' });
    }

    if (approvalRow.status !== 'pending') {
      return res.status(400).json({ success: false, message: '该审批已处理' });
    }

    const today = new Date().toISOString().split('T')[0];
    
    // 更新审批记录状态
    db.prepare(
      `UPDATE approvals SET status = 'approved', approver = ?, approvalDate = ? WHERE id = ?`
    ).run([approver || 'admin', today, id]);

    // 根据审批类型更新相关记录
    if (approvalRow.recordType === 'borrow') {
      // 更新借用记录状态
      db.prepare(`UPDATE borrowRecords SET status = 'borrowed' WHERE id = ?`).run([approvalRow.recordId]);

      // 更新样品状态
      const brRow = db.prepare(`SELECT sampleId FROM borrowRecords WHERE id = ?`).get([approvalRow.recordId]);
      if (brRow) {
        db.prepare(`UPDATE samples SET status = 'borrowed' WHERE id = ?`).run([brRow.sampleId]);
      }
    } else if (approvalRow.recordType === 'return') {
      // 更新借用记录状态
      db.prepare(`UPDATE borrowRecords SET status = 'returned' WHERE id = ?`).run([approvalRow.recordId]);

      // 更新样品状态
      const brRow = db.prepare(`SELECT sampleId FROM borrowRecords WHERE id = ?`).get([approvalRow.recordId]);
      if (brRow) {
        db.prepare(`UPDATE samples SET status = 'available' WHERE id = ?`).run([brRow.sampleId]);
      }
    } else if (approvalRow.recordType === 'registration') {
      // 用户注册审批通过
      db.prepare(`UPDATE users SET status = 'approved' WHERE id = ?`).run([approvalRow.recordId]);
    }

    res.json({ success: true, message: '审批已批准' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 拒绝申请
app.post('/api/approvals/:id/reject', (req, res) => {
  const { id } = req.params;
  const { approver, comment } = req.body;

  try {
    // 首先检查是否为注册审批（用户ID直接作为审批ID）
    const userRow = db.prepare(`SELECT * FROM users WHERE id = ?`).get([id]);
    if (userRow && userRow.status === 'pending') {
      // 注册审批 - 删除用户记录，允许重新注册
      db.prepare(`DELETE FROM users WHERE id = ?`).run([id]);
      res.json({ success: true, message: '注册申请已拒绝' });
      return;
    }

    // 原有的审批记录处理逻辑
    const approvalRow = db.prepare(`SELECT * FROM approvals WHERE id = ?`).get([id]);
    if (!approvalRow) {
      return res.status(404).json({ success: false, message: '审批记录不存在' });
    }

    if (approvalRow.status !== 'pending') {
      return res.status(400).json({ success: false, message: '该审批已处理' });
    }

    const today = new Date().toISOString().split('T')[0];
    
    // 更新审批记录状态
    db.prepare(
      `UPDATE approvals SET status = 'rejected', approver = ?, approvalDate = ?, comment = ? WHERE id = ?`
    ).run([approver || 'admin', today, comment || '', id]);

    // 根据审批类型更新相关记录
    if (approvalRow.recordType === 'borrow') {
      // 更新借用记录状态为拒绝，包含拒绝原因
      const rejectStatus = `借出被拒绝，理由：${comment || '无具体原因'}`;
      db.prepare(`UPDATE borrowRecords SET status = ? WHERE id = ?`).run([rejectStatus, approvalRow.recordId]);
    } else if (approvalRow.recordType === 'return') {
      // 归还申请被拒绝，保持借用状态但显示拒绝原因
      const rejectStatus = `归还被拒绝，理由：${comment || '无具体原因'}`;
      db.prepare(`UPDATE borrowRecords SET status = ? WHERE id = ?`).run([rejectStatus, approvalRow.recordId]);
    } else if (approvalRow.recordType === 'registration') {
      // 用户注册被拒绝
      db.prepare(`UPDATE users SET status = 'rejected' WHERE id = ?`).run([approvalRow.recordId]);
    }

    res.json({ success: true, message: '审批已拒绝' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 更新所有用户的借用状态和账号状态
app.post('/api/update-all-status', (req, res) => {
  const { userStatus, borrowStatus } = req.body;
  
  try {
    // 更新所有用户的账号状态
    if (userStatus && ['approved', 'rejected'].includes(userStatus)) {
      db.prepare(`UPDATE users SET status = ? WHERE status != 'pending'`).run([userStatus]);
    }
    
    // 更新所有借用记录的状态
    if (borrowStatus) {
      db.prepare(`UPDATE borrowRecords SET status = ?`).run([borrowStatus]);
      
      // 根据借用状态更新样品状态
      if (borrowStatus === 'returned') {
        // 如果借用状态改为已归还，将所有样品状态改为可用
        db.prepare(`UPDATE samples SET status = 'available'`).run();
      } else if (borrowStatus === 'borrowed' || borrowStatus.includes('借用中')) {
        // 如果借用状态改为借用中，将所有样品状态改为已借用
        db.prepare(`UPDATE samples SET status = 'borrowed'`).run();
      }
    }
    
    res.json({ success: true, message: '所有用户的借用状态和账号状态已更新' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 资产管理API接口

// 获取所有资产
app.get('/api/assets', (req, res) => {
  try {
    const assets = db.prepare(`SELECT * FROM assets ORDER BY createdAt DESC`).all();
    res.json({ success: true, assets });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 获取单个资产
app.get('/api/assets/:id', (req, res) => {
  const { id } = req.params;
  try {
    const asset = db.prepare(`SELECT * FROM assets WHERE id = ?`).get([id]);
    if (!asset) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }
    res.json({ success: true, asset });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 检查用户是否为管理员的辅助函数
function requireAdmin(req, res, next) {
  const userId = req.body.userId || req.query.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: '未登录' });
  }
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get([userId]);
  if (!user) {
    return res.status(401).json({ success: false, message: '用户不存在' });
  }
  if (user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '权限不足：仅管理员可进行此操作' });
  }
  next();
}

// 添加资产
app.post('/api/assets', requireAdmin, (req, res) => {
  const { model, code, user, notes, name, classification, systemName, systemInstallDate, diskSerial, bootTime, deviceSerial, ipAddress, macAddress } = req.body;
  try {
    // 检查资产编码是否已存在
    const existingAsset = db.prepare(`SELECT * FROM assets WHERE code = ?`).get([code]);
    if (existingAsset) {
      return res.status(400).json({ success: false, message: '资产编号已存在' });
    }

    const assetId = generateUniqueId();
    db.prepare(
      `INSERT INTO assets (id, model, code, user, notes, name, classification, systemName, systemInstallDate, diskSerial, bootTime, deviceSerial, ipAddress, macAddress, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')`
    ).run([assetId, model, code, user, notes, name, classification, systemName, systemInstallDate, diskSerial, bootTime, deviceSerial, ipAddress, macAddress]);

    res.json({ success: true, message: '资产添加成功', assetId });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 更新资产
app.put('/api/assets/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { model, code, user, notes, name, classification, systemName, systemInstallDate, diskSerial, bootTime, deviceSerial, ipAddress, macAddress } = req.body;
  try {
    // 检查资产是否存在
    const asset = db.prepare(`SELECT * FROM assets WHERE id = ?`).get([id]);
    if (!asset) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    // 检查资产编号是否已被其他资产使用
    const existingAsset = db.prepare(`SELECT * FROM assets WHERE code = ? AND id != ?`).get([code, id]);
    if (existingAsset) {
      return res.status(400).json({ success: false, message: '资产编号已被其他资产使用' });
    }

    db.prepare(
      `UPDATE assets SET model = ?, code = ?, user = ?, notes = ?, name = ?, classification = ?, systemName = ?, systemInstallDate = ?, diskSerial = ?, bootTime = ?, deviceSerial = ?, ipAddress = ?, macAddress = ? WHERE id = ?`
    ).run([model, code, user, notes, name, classification, systemName, systemInstallDate, diskSerial, bootTime, deviceSerial, ipAddress, macAddress, id]);

    res.json({ success: true, message: '资产更新成功' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 删除资产
app.delete('/api/assets/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  try {
    const asset = db.prepare(`SELECT * FROM assets WHERE id = ?`).get([id]);
    if (!asset) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    // 检查资产是否已借出
    if (asset.status === 'borrowed') {
      return res.status(400).json({ success: false, message: '该资产已借出，无法删除' });
    }

    db.prepare(`DELETE FROM assets WHERE id = ?`).run([id]);
    res.json({ success: true, message: '资产删除成功' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// ==================== 资产借用/归还审批流程（与样品管理一致）====================

// 创建资产借用申请（创建pending记录+审批记录，等待管理员审批）
app.post('/api/asset-borrow-records', (req, res) => {
  const { assetId, borrowerName, borrowDate, expectedReturnDate, borrowReason } = req.body;

  try {
    // 检查资产是否存在
    const asset = db.prepare(`SELECT * FROM assets WHERE id = ?`).get([assetId]);
    if (!asset) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    // 检查资产是否可借用（已有未完成的借用记录则不可再借）
    const activeBorrow = db.prepare(`SELECT * FROM assetBorrowRecords WHERE assetId = ? AND status NOT IN ('returned', 'rejected') AND status NOT LIKE '%被拒绝%'`).get([assetId]);
    if (activeBorrow) {
      return res.status(400).json({ success: false, message: '该资产已有未完成的借用申请，无法重复申请' });
    }

    const recordId = generateUniqueId();
    db.prepare(
      `INSERT INTO assetBorrowRecords (id, assetId, borrowerName, borrowDate, expectedReturnDate, borrowReason, status) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run([recordId, assetId, borrowerName, borrowDate, expectedReturnDate, borrowReason, 'pending']);

    // 创建审批记录
    const approvalId = generateUniqueId();
    db.prepare(
      `INSERT INTO assetApprovals (id, recordId, recordType, status) VALUES (?, ?, ?, ?)`
    ).run([approvalId, recordId, 'borrow', 'pending']);

    res.json({ success: true, message: '资产借用申请已提交，等待审批', recordId });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 获取所有资产借用记录（JOIN资产信息）
app.get('/api/asset-borrow-records', (req, res) => {
  const { borrowerName, status } = req.query;
  let query = `SELECT br.*, a.model as assetModel, a.code as assetCode FROM assetBorrowRecords br LEFT JOIN assets a ON br.assetId = a.id WHERE 1=1`;
  const params = [];

  if (borrowerName) {
    query += ` AND br.borrowerName LIKE ?`;
    params.push(`%${borrowerName}%`);
  }

  if (status) {
    query += ` AND br.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY br.createdAt DESC`;

  try {
    const rows = db.prepare(query).all(params);
    res.json({ success: true, records: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 申请归还资产（创建归还审批记录）
app.post('/api/asset-return-request', (req, res) => {
  const { recordId, actualReturnDate } = req.body;

  try {
    const borrowRow = db.prepare(`SELECT * FROM assetBorrowRecords WHERE id = ?`).get([recordId]);
    if (!borrowRow) {
      return res.status(404).json({ success: false, message: '借用记录不存在' });
    }

    // 允许借用中或被拒绝的记录重新申请归还
    const canRequestReturn = borrowRow.status === 'borrowed' ||
                           (borrowRow.status && borrowRow.status.includes('拒绝'));

    if (!canRequestReturn) {
      return res.status(400).json({ success: false, message: '该记录当前无法申请归还' });
    }

    db.prepare(
      `UPDATE assetBorrowRecords SET actualReturnDate = ?, status = ? WHERE id = ?`
    ).run([actualReturnDate, 'return_pending', recordId]);

    // 创建归还审批记录
    const approvalId = generateUniqueId();
    db.prepare(
      `INSERT INTO assetApprovals (id, recordId, recordType, status) VALUES (?, ?, ?, ?)`
    ).run([approvalId, recordId, 'return', 'pending']);

    res.json({ success: true, message: '资产归还申请已提交，等待审批' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 获取资产审批记录（借出/归还审批）
app.get('/api/asset-approvals', (req, res) => {
  const { type, status } = req.query;
  let query = `SELECT a.id as approvalId, a.recordId, a.recordType, a.status, a.approver, a.approvalDate, a.comment, br.borrowerName, br.borrowDate, br.expectedReturnDate, br.actualReturnDate, br.borrowReason as purpose, ast.model as assetModel, ast.code as assetCode FROM assetApprovals a LEFT JOIN assetBorrowRecords br ON a.recordId = br.id LEFT JOIN assets ast ON br.assetId = ast.id WHERE 1=1`;
  const params = [];

  if (type) {
    query += ` AND a.recordType = ?`;
    params.push(type);
  }

  if (status) {
    query += ` AND a.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY a.approvalDate DESC, a.id DESC`;

  try {
    const rows = db.prepare(query).all(params);
    const approvals = rows.map(row => ({
      id: row.approvalId,
      recordId: row.recordId,
      recordType: row.recordType,
      status: row.status,
      approver: row.approver,
      approvalDate: row.approvalDate,
      comment: row.comment,
      borrowerName: row.borrowerName,
      borrowDate: row.borrowDate,
      expectedReturnDate: row.expectedReturnDate,
      actualReturnDate: row.actualReturnDate,
      purpose: row.purpose,
      assetModel: row.assetModel,
      assetCode: row.assetCode
    }));
    res.json({ success: true, approvals });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 批准资产申请（借出/归还）
app.post('/api/asset-approvals/:id/approve', (req, res) => {
  const { id } = req.params;
  const { approver } = req.body;

  try {
    const approvalRow = db.prepare(`SELECT * FROM assetApprovals WHERE id = ?`).get([id]);
    if (!approvalRow) {
      return res.status(404).json({ success: false, message: '审批记录不存在' });
    }

    if (approvalRow.status !== 'pending') {
      return res.status(400).json({ success: false, message: '该审批已处理' });
    }

    const today = new Date().toISOString().split('T')[0];
    db.prepare(
      `UPDATE assetApprovals SET status = 'approved', approver = ?, approvalDate = ? WHERE id = ?`
    ).run([approver || 'admin', today, id]);

    if (approvalRow.recordType === 'borrow') {
      // 批准借出：更新借用记录状态 + 资产状态
      db.prepare(`UPDATE assetBorrowRecords SET status = 'borrowed' WHERE id = ?`).run([approvalRow.recordId]);
      const brRow = db.prepare(`SELECT assetId, borrowerName, borrowDate, expectedReturnDate, borrowReason FROM assetBorrowRecords WHERE id = ?`).get([approvalRow.recordId]);
      if (brRow) {
        db.prepare(`UPDATE assets SET status = 'borrowed', user = ?, borrowDate = ?, expectedReturnDate = ?, borrowReason = ? WHERE id = ?`).run([brRow.borrowerName, brRow.borrowDate, brRow.expectedReturnDate, brRow.borrowReason, brRow.assetId]);
      }
    } else if (approvalRow.recordType === 'return') {
      // 批准归还：更新借用记录状态 + 资产状态
      db.prepare(`UPDATE assetBorrowRecords SET status = 'returned' WHERE id = ?`).run([approvalRow.recordId]);
      const brRow = db.prepare(`SELECT assetId FROM assetBorrowRecords WHERE id = ?`).get([approvalRow.recordId]);
      if (brRow) {
        db.prepare(`UPDATE assets SET status = 'available', user = '研发管理库', borrowDate = NULL, expectedReturnDate = NULL, borrowReason = NULL WHERE id = ?`).run([brRow.assetId]);
      }
    }

    res.json({ success: true, message: '审批已批准' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 拒绝资产申请（借出/归还）
app.post('/api/asset-approvals/:id/reject', (req, res) => {
  const { id } = req.params;
  const { approver, comment } = req.body;

  try {
    const approvalRow = db.prepare(`SELECT * FROM assetApprovals WHERE id = ?`).get([id]);
    if (!approvalRow) {
      return res.status(404).json({ success: false, message: '审批记录不存在' });
    }

    if (approvalRow.status !== 'pending') {
      return res.status(400).json({ success: false, message: '该审批已处理' });
    }

    const today = new Date().toISOString().split('T')[0];
    db.prepare(
      `UPDATE assetApprovals SET status = 'rejected', approver = ?, approvalDate = ?, comment = ? WHERE id = ?`
    ).run([approver || 'admin', today, comment || '', id]);

    if (approvalRow.recordType === 'borrow') {
      const rejectStatus = `借出被拒绝，理由：${comment || '无具体原因'}`;
      db.prepare(`UPDATE assetBorrowRecords SET status = ? WHERE id = ?`).run([rejectStatus, approvalRow.recordId]);
    } else if (approvalRow.recordType === 'return') {
      const rejectStatus = `归还被拒绝，理由：${comment || '无具体原因'}`;
      db.prepare(`UPDATE assetBorrowRecords SET status = ? WHERE id = ?`).run([rejectStatus, approvalRow.recordId]);
    }

    res.json({ success: true, message: '审批已拒绝' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 兼容旧接口：直接借出资产（保留，但前端不再使用）
app.put('/api/assets/:id/borrow', (req, res) => {
  const { id } = req.params;
  const { user, borrowDate, expectedReturnDate, borrowReason } = req.body;
  try {
    const asset = db.prepare(`SELECT * FROM assets WHERE id = ?`).get([id]);
    if (!asset) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    if (asset.status === 'borrowed') {
      return res.status(400).json({ success: false, message: '该资产已被借出' });
    }

    db.prepare(`UPDATE assets SET status = 'borrowed', user = ?, borrowDate = ?, expectedReturnDate = ?, borrowReason = ? WHERE id = ?`).run([user, borrowDate, expectedReturnDate, borrowReason, id]);
    res.json({ success: true, message: '资产借出成功' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 兼容旧接口：直接归还资产（保留，但前端不再使用）
app.put('/api/assets/:id/return', (req, res) => {
  const { id } = req.params;
  try {
    const asset = db.prepare(`SELECT * FROM assets WHERE id = ?`).get([id]);
    if (!asset) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    if (asset.status === 'available') {
      return res.status(400).json({ success: false, message: '该资产未被借出' });
    }

    db.prepare(`UPDATE assets SET status = 'available', user = NULL, borrowDate = NULL, expectedReturnDate = NULL, borrowReason = NULL WHERE id = ?`).run([id]);
    res.json({ success: true, message: '资产归还成功' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// ==================== 工装管理 API ====================

// 获取所有工装
app.get('/api/tooling', (req, res) => {
  try {
    const tooling = db.prepare(`SELECT * FROM tooling ORDER BY createdAt DESC`).all();
    res.json({ success: true, tooling });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 获取单个工装
app.get('/api/tooling/:id', (req, res) => {
  const { id } = req.params;
  try {
    const tool = db.prepare(`SELECT * FROM tooling WHERE id = ?`).get([id]);
    if (!tool) {
      return res.status(404).json({ success: false, message: '工装不存在' });
    }
    res.json({ success: true, tool });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 添加工装
app.post('/api/tooling', requireAdmin, (req, res) => {
  const { category, name, model, deviceCode, responsiblePerson, manufacturer, serialNumber, usageScope, loginDate, deviceStatus, usageStatus, amount, channel, notes } = req.body;
  try {
    const existing = db.prepare(`SELECT * FROM tooling WHERE deviceCode = ?`).get([deviceCode]);
    if (existing) {
      return res.status(400).json({ success: false, message: '工装编号已存在' });
    }
    const toolId = generateUniqueId();
    db.prepare(
      `INSERT INTO tooling (id, category, name, model, deviceCode, responsiblePerson, manufacturer, serialNumber, usageScope, loginDate, deviceStatus, usageStatus, amount, channel, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')`
    ).run([toolId, category, name, model, deviceCode, responsiblePerson, manufacturer, serialNumber, usageScope, loginDate, deviceStatus, usageStatus, amount, channel, notes]);
    res.json({ success: true, message: '工装添加成功', toolId });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 更新工装
app.put('/api/tooling/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { category, name, model, deviceCode, responsiblePerson, manufacturer, serialNumber, usageScope, loginDate, deviceStatus, usageStatus, amount, channel, notes } = req.body;
  try {
    const tool = db.prepare(`SELECT * FROM tooling WHERE id = ?`).get([id]);
    if (!tool) {
      return res.status(404).json({ success: false, message: '工装不存在' });
    }
    const existing = db.prepare(`SELECT * FROM tooling WHERE deviceCode = ? AND id != ?`).get([deviceCode, id]);
    if (existing) {
      return res.status(400).json({ success: false, message: '工装编号已被其他工装使用' });
    }
    db.prepare(
      `UPDATE tooling SET category = ?, name = ?, model = ?, deviceCode = ?, responsiblePerson = ?, manufacturer = ?, serialNumber = ?, usageScope = ?, loginDate = ?, deviceStatus = ?, usageStatus = ?, amount = ?, channel = ?, notes = ? WHERE id = ?`
    ).run([category, name, model, deviceCode, responsiblePerson, manufacturer, serialNumber, usageScope, loginDate, deviceStatus, usageStatus, amount, channel, notes, id]);
    res.json({ success: true, message: '工装更新成功' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 删除工装
app.delete('/api/tooling/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  try {
    const tool = db.prepare(`SELECT * FROM tooling WHERE id = ?`).get([id]);
    if (!tool) {
      return res.status(404).json({ success: false, message: '工装不存在' });
    }
    if (tool.status === 'borrowed') {
      return res.status(400).json({ success: false, message: '该工装已借出，无法删除' });
    }
    db.prepare(`DELETE FROM tooling WHERE id = ?`).run([id]);
    res.json({ success: true, message: '工装删除成功' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 创建工装借用申请
app.post('/api/tooling-borrow-records', (req, res) => {
  const { toolingId, borrowerName, borrowDate, expectedReturnDate, borrowReason } = req.body;
  try {
    const tool = db.prepare(`SELECT * FROM tooling WHERE id = ?`).get([toolingId]);
    if (!tool) {
      return res.status(404).json({ success: false, message: '工装不存在' });
    }
    if (tool.status === 'borrowed') {
      return res.status(400).json({ success: false, message: '该工装已被借出' });
    }
    const activeRecord = db.prepare(`SELECT * FROM toolingBorrowRecords WHERE toolingId = ? AND status IN ('pending', 'borrowed', 'return_pending')`).get([toolingId]);
    if (activeRecord) {
      return res.status(400).json({ success: false, message: '该工装存在未完成的借用申请' });
    }
    const recordId = generateUniqueId();
    db.prepare(
      `INSERT INTO toolingBorrowRecords (id, toolingId, borrowerName, borrowDate, expectedReturnDate, borrowReason, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    ).run([recordId, toolingId, borrowerName, borrowDate, expectedReturnDate, borrowReason]);
    const approvalId = generateUniqueId();
    db.prepare(
      `INSERT INTO toolingApprovals (id, recordId, recordType, status) VALUES (?, ?, 'borrow', 'pending')`
    ).run([approvalId, recordId]);
    res.json({ success: true, message: '工装借用申请已提交，等待审批', recordId });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 获取工装借用记录
app.get('/api/tooling-borrow-records', (req, res) => {
  const { borrowerName, status } = req.query;
  let query = `SELECT br.*, t.name as toolingName, t.model as toolingModel, t.deviceCode as toolingCode FROM toolingBorrowRecords br LEFT JOIN tooling t ON br.toolingId = t.id WHERE 1=1`;
  const params = [];
  if (borrowerName) {
    query += ` AND br.borrowerName LIKE ?`;
    params.push(`%${borrowerName}%`);
  }
  if (status) {
    query += ` AND br.status = ?`;
    params.push(status);
  }
  query += ` ORDER BY br.borrowDate ASC`;
  try {
    const rows = db.prepare(query).all(params);
    res.json({ success: true, records: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 工装归还申请
app.post('/api/tooling-return-request', (req, res) => {
  const { recordId, actualReturnDate } = req.body;
  try {
    const borrowRow = db.prepare(`SELECT * FROM toolingBorrowRecords WHERE id = ?`).get([recordId]);
    if (!borrowRow) {
      return res.status(404).json({ success: false, message: '借用记录不存在' });
    }
    const canRequestReturn = borrowRow.status === 'borrowed' ||
      (borrowRow.status && borrowRow.status.includes('拒绝'));
    if (!canRequestReturn) {
      return res.status(400).json({ success: false, message: '该记录当前无法申请归还' });
    }
    db.prepare(
      `UPDATE toolingBorrowRecords SET actualReturnDate = ?, status = 'return_pending' WHERE id = ?`
    ).run([actualReturnDate, recordId]);
    const approvalId = generateUniqueId();
    db.prepare(
      `INSERT INTO toolingApprovals (id, recordId, recordType, status) VALUES (?, ?, 'return', 'pending')`
    ).run([approvalId, recordId]);
    res.json({ success: true, message: '工装归还申请已提交，等待审批' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 获取工装审批记录
app.get('/api/tooling-approvals', (req, res) => {
  const { status } = req.query;
  let query = `SELECT a.id as approvalId, a.recordId, a.recordType, a.status, a.approver, a.approvalDate, a.comment, br.borrowerName, br.borrowDate, br.expectedReturnDate, br.actualReturnDate, br.borrowReason, t.name as toolingName, t.model as toolingModel, t.deviceCode as toolingCode FROM toolingApprovals a LEFT JOIN toolingBorrowRecords br ON a.recordId = br.id LEFT JOIN tooling t ON br.toolingId = t.id WHERE 1=1`;
  const params = [];
  if (status) {
    query += ` AND a.status = ?`;
    params.push(status);
  }
  query += ` ORDER BY a.createdAt DESC`;
  try {
    const rows = db.prepare(query).all(params);
    res.json({ success: true, approvals: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 工装审批通过
app.post('/api/tooling-approvals/:id/approve', (req, res) => {
  const { id } = req.params;
  const { approver, comment } = req.body;
  try {
    const approval = db.prepare(`SELECT * FROM toolingApprovals WHERE id = ?`).get([id]);
    if (!approval) {
      return res.status(404).json({ success: false, message: '审批记录不存在' });
    }
    if (approval.status !== 'pending') {
      return res.status(400).json({ success: false, message: '该审批已处理' });
    }
    db.prepare(
      `UPDATE toolingApprovals SET status = 'approved', approver = ?, approvalDate = datetime('now', 'localtime'), comment = ? WHERE id = ?`
    ).run([approver, comment, id]);
    const borrowRecord = db.prepare(`SELECT * FROM toolingBorrowRecords WHERE id = ?`).get([approval.recordId]);
    if (approval.recordType === 'borrow') {
      db.prepare(
        `UPDATE toolingBorrowRecords SET status = 'borrowed' WHERE id = ?`
      ).run([approval.recordId]);
      if (borrowRecord) {
        db.prepare(`UPDATE tooling SET status = 'borrowed', responsiblePerson = ? WHERE id = ?`).run([borrowRecord.borrowerName, borrowRecord.toolingId]);
      }
    } else if (approval.recordType === 'return') {
      db.prepare(
        `UPDATE toolingBorrowRecords SET status = 'returned' WHERE id = ?`
      ).run([approval.recordId]);
      if (borrowRecord) {
        db.prepare(`UPDATE tooling SET status = 'available', responsiblePerson = '研发管理库' WHERE id = ?`).run([borrowRecord.toolingId]);
      }
    }
    res.json({ success: true, message: '审批通过' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

// 工装审批拒绝
app.post('/api/tooling-approvals/:id/reject', (req, res) => {
  const { id } = req.params;
  const { approver, comment } = req.body;
  try {
    const approval = db.prepare(`SELECT * FROM toolingApprovals WHERE id = ?`).get([id]);
    if (!approval) {
      return res.status(404).json({ success: false, message: '审批记录不存在' });
    }
    if (approval.status !== 'pending') {
      return res.status(400).json({ success: false, message: '该审批已处理' });
    }
    db.prepare(
      `UPDATE toolingApprovals SET status = 'rejected', approver = ?, approvalDate = datetime('now', 'localtime'), comment = ? WHERE id = ?`
    ).run([approver, comment, id]);
    if (approval.recordType === 'borrow') {
      db.prepare(
        `UPDATE toolingBorrowRecords SET status = 'rejected' WHERE id = ?`
      ).run([approval.recordId]);
    } else if (approval.recordType === 'return') {
      db.prepare(
        `UPDATE toolingBorrowRecords SET status = 'return_rejected' WHERE id = ?`
      ).run([approval.recordId]);
    }
    res.json({ success: true, message: '审批已拒绝' });
  } catch (err) {
    return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
  }
});

app.get('/api/server-info', (req, res) => res.json({
  ok: true,
  version: '2026-09-15-board-modules',
  directory: __dirname
}));

// 启动服务器
registerBoardApi(app, db, requireAdmin);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://0.0.0.0:${PORT}`);
  console.log(`服务目录: ${__dirname}`);
  console.log(`其他电脑可以通过 http://[服务器IP地址]:${PORT}/研发样品管理系统.html 访问系统`);
});
