const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

class DataBackupRestore {
    constructor() {
        this.dbPath = './sample_management.db';
        this.backupDir = './backups';
        this.ensureBackupDir();
    }

    ensureBackupDir() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    // 创建完整备份
    createFullBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(this.backupDir, `backup_${timestamp}.db`);
            
            // 使用SQLite的备份功能
            const sourceDb = new Database(this.dbPath);
            const backupDb = new Database(backupPath);
            
            sourceDb.backup(backupPath)
                .then(() => {
                    console.log('✅ 备份创建成功:', backupPath);
                    console.log('备份文件大小:', (fs.statSync(backupPath).size / 1024).toFixed(2), 'KB');
                    
                    // 创建备份信息文件
                    const infoPath = path.join(this.backupDir, `backup_${timestamp}.info`);
                    fs.writeFileSync(infoPath, JSON.stringify({
                        timestamp: new Date().toISOString(),
                        dbSize: fs.statSync(this.dbPath).size,
                        tables: this.getTableCounts(),
                        version: '1.0'
                    }, null, 2));
                    
                    console.log('备份信息已保存');
                })
                .catch(err => {
                    console.error('备份失败:', err.message);
                })
                .finally(() => {
                    sourceDb.close();
                    backupDb.close();
                });
                
        } catch (error) {
            console.error('备份错误:', error.message);
        }
    }

    // 获取表数据量
    getTableCounts() {
        try {
            const db = new Database(this.dbPath);
            const tables = ['users', 'samples', 'borrowRecords', 'approvals'];
            const counts = {};
            
            tables.forEach(table => {
                try {
                    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
                    counts[table] = count.count;
                } catch (e) {
                    counts[table] = 0;
                }
            });
            
            db.close();
            return counts;
        } catch (error) {
            return {};
        }
    }

    // 列出所有备份
    listBackups() {
        try {
            const backups = fs.readdirSync(this.backupDir)
                .filter(file => file.endsWith('.db'))
                .map(file => {
                    const filePath = path.join(this.backupDir, file);
                    const stats = fs.statSync(filePath);
                    const infoFile = file.replace('.db', '.info');
                    const infoPath = path.join(this.backupDir, infoFile);
                    
                    let info = {};
                    if (fs.existsSync(infoPath)) {
                        try {
                            info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                        } catch (e) {
                            info = { error: '无法读取信息文件' };
                        }
                    }
                    
                    return {
                        filename: file,
                        path: filePath,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime,
                        info: info
                    };
                })
                .sort((a, b) => b.created - a.created);
            
            return backups;
        } catch (error) {
            console.error('列出备份失败:', error.message);
            return [];
        }
    }

    // 从备份恢复
    restoreFromBackup(backupPath) {
        try {
            if (!fs.existsSync(backupPath)) {
                console.error('备份文件不存在:', backupPath);
                return false;
            }

            // 创建当前数据库的临时备份
            const tempBackup = path.join(this.backupDir, `temp_before_restore_${Date.now()}.db`);
            fs.copyFileSync(this.dbPath, tempBackup);
            console.log('当前数据库已临时备份:', tempBackup);

            // 停止当前数据库连接
            console.log('正在恢复数据...');
            
            // 替换数据库文件
            fs.copyFileSync(backupPath, this.dbPath);
            
            console.log('✅ 数据恢复成功');
            console.log('恢复后的数据库大小:', (fs.statSync(this.dbPath).size / 1024).toFixed(2), 'KB');
            
            return true;
        } catch (error) {
            console.error('恢复失败:', error.message);
            return false;
        }
    }

    // 导出数据为JSON
    exportToJSON() {
        try {
            const db = new Database(this.dbPath);
            const data = {};
            
            const tables = ['users', 'samples', 'borrowRecords', 'approvals'];
            tables.forEach(table => {
                try {
                    const rows = db.prepare(`SELECT * FROM ${table}`).all();
                    data[table] = rows;
                } catch (e) {
                    data[table] = [];
                }
            });
            
            const jsonPath = path.join(this.backupDir, `export_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
            fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
            
            console.log('✅ 数据导出成功:', jsonPath);
            console.log('导出文件大小:', (fs.statSync(jsonPath).size / 1024).toFixed(2), 'KB');
            
            db.close();
            return jsonPath;
        } catch (error) {
            console.error('导出失败:', error.message);
            return null;
        }
    }

    // 从JSON导入数据
    importFromJSON(jsonPath) {
        try {
            if (!fs.existsSync(jsonPath)) {
                console.error('JSON文件不存在:', jsonPath);
                return false;
            }

            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            const db = new Database(this.dbPath);

            // 清空现有数据
            db.prepare('DELETE FROM approvals').run();
            db.prepare('DELETE FROM borrowRecords').run();
            db.prepare('DELETE FROM samples').run();
            db.prepare('DELETE FROM users').run();

            // 导入数据
            if (data.users) {
                const stmt = db.prepare('INSERT INTO users (id, username, password, role, phone) VALUES (?, ?, ?, ?, ?)');
                data.users.forEach(user => stmt.run(user.id, user.username, user.password, user.role, user.phone));
            }

            if (data.samples) {
                const stmt = db.prepare(`INSERT INTO samples (id, machineName, productModel, productName, productCode, pcbCode, productFunction, physicalLocation, rdManager, managementMethod, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                data.samples.forEach(sample => stmt.run(
                    sample.id, sample.machineName, sample.productModel, sample.productName, 
                    sample.productCode, sample.pcbCode, sample.productFunction, sample.physicalLocation,
                    sample.rdManager, sample.managementMethod, sample.notes, sample.status
                ));
            }

            if (data.borrowRecords) {
                const stmt = db.prepare('INSERT INTO borrowRecords (id, sampleId, borrowerName, borrowDate, expectedReturnDate, actualReturnDate, borrowReason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
                data.borrowRecords.forEach(record => stmt.run(
                    record.id, record.sampleId, record.borrowerName, record.borrowDate,
                    record.expectedReturnDate, record.actualReturnDate, record.borrowReason, record.status
                ));
            }

            if (data.approvals) {
                const stmt = db.prepare('INSERT INTO approvals (id, recordId, recordType, approver, approvalDate, status, comment) VALUES (?, ?, ?, ?, ?, ?, ?)');
                data.approvals.forEach(approval => stmt.run(
                    approval.id, approval.recordId, approval.recordType, approval.approver,
                    approval.approvalDate, approval.status, approval.comment
                ));
            }

            console.log('✅ 数据导入成功');
            db.close();
            return true;
        } catch (error) {
            console.error('导入失败:', error.message);
            return false;
        }
    }
}

// 自动备份功能
function setupAutoBackup() {
    const backup = new DataBackupRestore();
    
    // 每天自动备份
    setInterval(() => {
        console.log('执行自动备份...');
        backup.createFullBackup();
    }, 24 * 60 * 60 * 1000); // 24小时
    
    // 每周清理旧备份（保留最近7天）
    setInterval(() => {
        const backups = backup.listBackups();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        
        backups.forEach(backup => {
            if (backup.created < cutoffDate) {
                fs.unlinkSync(backup.path);
                const infoPath = backup.path.replace('.db', '.info');
                if (fs.existsSync(infoPath)) {
                    fs.unlinkSync(infoPath);
                }
                console.log('删除旧备份:', backup.filename);
            }
        });
    }, 24 * 60 * 60 * 1000);
}

// 导出功能供外部使用
module.exports = { DataBackupRestore, setupAutoBackup };

// 如果直接运行此脚本
if (require.main === module) {
    const backup = new DataBackupRestore();
    
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch(command) {
        case 'backup':
            backup.createFullBackup();
            break;
        case 'list':
            const backups = backup.listBackups();
            console.table(backups.map(b => ({
                filename: b.filename,
                size: `${(b.size/1024).toFixed(2)}KB`,
                created: b.created.toLocaleString()
            })));
            break;
        case 'export':
            backup.exportToJSON();
            break;
        case 'restore':
            if (args[1]) {
                backup.restoreFromBackup(args[1]);
            } else {
                console.log('请提供备份文件路径');
            }
            break;
        default:
            console.log('使用方法:');
            console.log('node backup_restore.js backup    - 创建备份');
            console.log('node backup_restore.js list      - 列出备份');
            console.log('node backup_restore.js export    - 导出JSON');
            console.log('node backup_restore.js restore [文件路径] - 恢复数据');
    }
}