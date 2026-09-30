@echo off
REM 开机自启动Node.js服务脚本
REM 设置为UTF-8编码，确保中文正常显示
chcp 65001 >nul

REM 设置Node.js路径（根据实际安装路径修改）
SET "NODE_PATH=D:\02_Software\16_Tool\node\node.exe"

REM 检查Node.js是否存在，如果不存在则尝试默认路径
IF NOT EXIST "%NODE_PATH%" (
    ECHO 未找到指定的Node.js路径，尝试默认路径...
    SET "NODE_PATH=C:\Program Files\nodejs\node.exe"
    IF NOT EXIST "%NODE_PATH%" (
        SET "NODE_PATH=C:\Program Files (x86)\nodejs\node.exe"
        IF NOT EXIST "%NODE_PATH%" (
            ECHO 错误：未找到Node.js！请先安装Node.js。
            PAUSE
            EXIT /B 1
        )
    )
)

REM 设置当前目录为脚本所在目录
cd /d %~dp0

REM 添加Node.js到临时环境变量PATH中，确保可以访问npm等命令
FOR %%i IN ("%NODE_PATH%") DO SET "PATH=%%~dpi;%PATH%"

REM 检查server.js是否存在
IF NOT EXIST "server.js" (
    ECHO 错误：未找到server.js文件！请确保脚本位于正确的项目目录中。
    PAUSE
    EXIT /B 1
)

REM 显示启动信息
ECHO. 
ECHO ======================================================
ECHO          开机自启Node.js服务 - 启动中...
ECHO ======================================================
ECHO 当前目录: %CD%
ECHO Node.js路径: %NODE_PATH%

REM 获取Node.js版本信息
CALL "%NODE_PATH%" --version

REM 启动服务，使用start命令创建新窗口运行，避免关闭窗口后服务停止
ECHO. 
ECHO 正在启动服务...
start "Node.js Server - Sample Management System" cmd /k ""%NODE_PATH%" server.js"

ECHO. 
ECHO 服务已启动，请在弹出的窗口中查看运行状态。
ECHO 如果需要停止服务，请关闭对应的命令提示符窗口。
ECHO ======================================================

REM 设置隐藏窗口运行（可选，取消下面两行注释可实现隐藏窗口启动）
REM IF NOT DEFINED IS_HIDE (SET IS_HIDE=1 && start /min "" "%~f0") ELSE (
REM     EXIT
REM )

REM 等待2秒后退出，避免显示过多窗口
TIMEOUT /T 2 >nul
EXIT /B 0