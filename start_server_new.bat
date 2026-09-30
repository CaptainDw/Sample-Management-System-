@echo off
REM 启动服务器批处理文件（增强版）

REM 无论从快捷方式还是其他目录启动，都固定切换到本脚本所在项目目录
cd /d "%~dp0"

REM 尝试自动查找Node.js路径
set "NODE_PATH="
REM 检查用户指定的Node.js路径
if exist "D:\02_Software\16_Tool\node\node.exe" set "NODE_PATH=D:\02_Software\16_Tool\node"
REM 检查默认安装路径
if exist "C:\Program Files\nodejs\node.exe" set "NODE_PATH=C:\Program Files\nodejs"
if exist "C:\Program Files (x86)\nodejs\node.exe" set "NODE_PATH=C:\Program Files (x86)\nodejs"
if exist "%USERPROFILE%\AppData\Local\nodejs\node.exe" set "NODE_PATH=%USERPROFILE%\AppData\Local\nodejs"

REM 如果未找到Node.js，提示用户并退出
if "%NODE_PATH%"=="" (
    echo 错误: 未找到Node.js安装路径
    echo 请确保已安装Node.js，并在本脚本中手动设置NODE_PATH
    pause
    exit /b 1
)

REM 将Node.js路径添加到临时环境变量
set "PATH=%NODE_PATH%;%PATH%"

REM 检查当前目录是否包含server.js
if not exist "server.js" (
    echo 错误: 在当前目录未找到server.js文件
    echo 当前目录: %CD%
    pause
    exit /b 1
)

REM 显示调试信息
echo ============== 启动信息 ==============
echo 当前路径: %CD%
echo Node.js路径: %NODE_PATH%
node -v
echo =====================================

REM 启动服务器
echo 正在启动服务器...
node server.js

REM 如果服务器启动失败，显示错误信息
if %ERRORLEVEL% NEQ 0 (
    echo 错误: 服务器启动失败，错误代码: %ERRORLEVEL%
    pause
    exit /b %ERRORLEVEL%
)

REM 暂停以查看输出
pause
