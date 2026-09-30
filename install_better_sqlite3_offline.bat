@echo off
REM better-sqlite3离线安装辅助脚本
REM 设置为UTF-8编码
chcp 65001 >nul

ECHO.
ECHO ======================================================
ECHO            better-sqlite3 离线安装辅助工具
ECHO ======================================================
ECHO 本脚本将帮助您在离线环境中安装better-sqlite3模块
ECHO 版本要求：better-sqlite3@12.2.0
ECHO ======================================================

REM 检查Node.js是否安装
node --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    ECHO 错误：未找到Node.js！请先安装Node.js。
    PAUSE
    EXIT /B 1
) ELSE (
    ECHO 已安装Node.js版本：
    node --version
)

REM 检查npm是否安装
npm --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    ECHO 错误：未找到npm！请确保Node.js安装正确。
    PAUSE
    EXIT /B 1
) ELSE (
    ECHO 已安装npm版本：
    npm --version
)

ECHO.
ECHO ======================================================
ECHO 请选择安装方式：
ECHO 1. 从本地tgz安装包安装
ECHO 2. 从完整的node_modules目录恢复
ECHO 3. 安装所需的构建工具（仅Windows）
ECHO 4. 验证已安装的better-sqlite3
ECHO 5. 退出
ECHO ======================================================

SET /P CHOICE="请输入选项 [1-5]: "

IF "%CHOICE%"=="1" GOTO INSTALL_FROM_TGZ
IF "%CHOICE%"=="2" GOTO RESTORE_FROM_NODE_MODULES
IF "%CHOICE%"=="3" GOTO INSTALL_BUILD_TOOLS
IF "%CHOICE%"=="4" GOTO VERIFY_INSTALLATION
IF "%CHOICE%"=="5" GOTO END

ECHO 无效的选项！
PAUSE
GOTO END

:INSTALL_FROM_TGZ
ECHO.
ECHO 请确保better-sqlite3-12.2.0.tgz文件已复制到当前目录
SET /P CONFIRM="文件已准备好？[Y/N]: "
IF /I NOT "%CONFIRM%"=="Y" GOTO END

IF NOT EXIST "better-sqlite3-12.2.0.tgz" (
    ECHO 错误：未找到better-sqlite3-12.2.0.tgz文件！
    PAUSE
    EXIT /B 1
)

ECHO 正在安装better-sqlite3-12.2.0.tgz...
npm install ./better-sqlite3-12.2.0.tgz

IF %ERRORLEVEL% EQU 0 (
    ECHO 安装成功！
) ELSE (
    ECHO 安装失败！请检查错误信息，可能需要安装构建工具。
    ECHO 建议运行选项3安装必要的构建工具，然后重试。
)

PAUSE
GOTO END

:RESTORE_FROM_NODE_MODULES
ECHO.
ECHO 请确保完整的node_modules目录已复制到当前项目目录
SET /P CONFIRM="目录已准备好？[Y/N]: "
IF /I NOT "%CONFIRM%"=="Y" GOTO END

IF NOT EXIST "node_modules" (
    ECHO 错误：未找到node_modules目录！
    PAUSE
    EXIT /B 1
)

IF NOT EXIST "node_modules\better-sqlite3" (
    ECHO 警告：node_modules目录中未找到better-sqlite3！
    ECHO 可能需要从tgz文件安装。
    PAUSE
    EXIT /B 1
)

ECHO 正在验证node_modules中的better-sqlite3...
node -e "try { require('better-sqlite3'); console.log('验证成功！better-sqlite3已正确安装在node_modules中。'); } catch (e) { console.error('验证失败：', e.message); }"

PAUSE
GOTO END

:INSTALL_BUILD_TOOLS
ECHO.
ECHO 此选项将尝试安装Windows构建工具，可能需要联网下载
ECHO （仅适用于Windows系统）
SET /P CONFIRM="是否继续？[Y/N]: "
IF /I NOT "%CONFIRM%"=="Y" GOTO END

ECHO 正在安装Windows构建工具...
ECHO 注意：这可能需要一段时间，并可能需要管理员权限。

REM 尝试安装windows-build-tools（旧版本Node.js）
npm install --global windows-build-tools --production --vs2015

IF %ERRORLEVEL% NEQ 0 (
    ECHO windows-build-tools安装失败，尝试其他方法...
    ECHO 请手动从Microsoft官网下载并安装Visual Studio Build Tools
    ECHO 或安装Visual Studio Community Edition并选择"使用C++的桌面开发"
)

ECHO 安装完成！请重启命令提示符后再尝试安装better-sqlite3。
PAUSE
GOTO END

:VERIFY_INSTALLATION
ECHO.
ECHO 正在验证better-sqlite3是否正确安装...
node -e "try { const Database = require('better-sqlite3'); console.log('better-sqlite3已成功安装！版本：' + require('better-sqlite3/package.json').version); const testDb = new Database(':memory:'); testDb.prepare('CREATE TABLE test (id INTEGER)').run(); testDb.prepare('INSERT INTO test VALUES (1)').run(); const result = testDb.prepare('SELECT * FROM test').get(); console.log('数据库操作测试成功！查询结果：', result); testDb.close(); } catch (e) { console.error('验证失败：', e.message); process.exit(1); }"

IF %ERRORLEVEL% EQU 0 (
    ECHO 验证成功！better-sqlite3可以正常使用。
) ELSE (
    ECHO 验证失败！better-sqlite3可能安装不完整或有问题。
    ECHO 建议重新安装，或检查构建工具是否正确安装。
)

PAUSE
GOTO END

:END
ECHO.
ECHO ======================================================
ECHO                   操作已完成
ECHO ======================================================
ECHO 如有任何问题，请参考better-sqlite3离线安装指南.md文件
EXIT /B 0