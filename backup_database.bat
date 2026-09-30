@echo off
REM 数据库备份脚本 - 每月自动备份sample_management.db

REM 设置变量
set "SOURCE_DB=sample_management.db"
set "BACKUP_DIR=backups"
set "LOG_FILE=backup_log.txt"

REM 确保日志文件存在
type nul > "%LOG_FILE%" 2>nul

REM 获取当前日期，格式：YYYYMMDD
for /f "tokens=2 delims==" %%a in ('wmic os get localdatetime /value') do set "DATETIME=%%a"
set "CURRENT_DATE=%DATETIME:~0,8%"
set "CURRENT_TIME=%DATETIME:~8,6%"

REM 显示开始备份信息
echo [%CURRENT_DATE% %CURRENT_TIME:~0,2%:%CURRENT_TIME:~2,2%:%CURRENT_TIME:~4,2%] 开始数据库备份... >> "%LOG_FILE%"

REM 创建备份目录（如果不存在）
if not exist "%BACKUP_DIR%" (
    mkdir "%BACKUP_DIR%"
    if errorlevel 1 (
        echo [%CURRENT_DATE% %CURRENT_TIME:~0,2%:%CURRENT_TIME:~2,2%:%CURRENT_TIME:~4,2%] 错误: 无法创建备份目录 %BACKUP_DIR% >> "%LOG_FILE%"
        exit /b 1
    ) else (
        echo [%CURRENT_DATE% %CURRENT_TIME:~0,2%:%CURRENT_TIME:~2,2%:%CURRENT_TIME:~4,2%] 已创建备份目录: %BACKUP_DIR% >> "%LOG_FILE%"
    )
)

REM 检查源数据库文件是否存在
if not exist "%SOURCE_DB%" (
    echo [%CURRENT_DATE% %CURRENT_TIME:~0,2%:%CURRENT_TIME:~2,2%:%CURRENT_TIME:~4,2%] 错误: 源数据库文件 %SOURCE_DB% 不存在 >> "%LOG_FILE%"
    exit /b 1
) else (
    REM 检查文件大小，确保不是空文件
    for %%f in ("%SOURCE_DB%") do set "FILE_SIZE=%%~zf"
    if %FILE_SIZE% LSS 100 (
        echo [%CURRENT_DATE% %CURRENT_TIME:~0,2%:%CURRENT_TIME:~2,2%:%CURRENT_TIME:~4,2%] 警告: 源数据库文件 %SOURCE_DB% 可能为空或损坏（大小: %FILE_SIZE% 字节） >> "%LOG_FILE%"
    )
)

REM 创建备份文件
set "BACKUP_FILE=%BACKUP_DIR%\sample_management_%CURRENT_DATE%.db"

REM 复制数据库文件
copy /y "%SOURCE_DB%" "%BACKUP_FILE%"
if errorlevel 1 (
    echo [%CURRENT_DATE% %CURRENT_TIME:~0,2%:%CURRENT_TIME:~2,2%:%CURRENT_TIME:~4,2%] 错误: 备份失败，无法复制数据库文件 >> "%LOG_FILE%"
    exit /b 1
) else (
    echo [%CURRENT_DATE% %CURRENT_TIME:~0,2%:%CURRENT_TIME:~2,2%:%CURRENT_TIME:~4,2%] 成功: 数据库已备份到 %BACKUP_FILE% >> "%LOG_FILE%"
    REM 验证备份文件
    if exist "%BACKUP_FILE%" (
        for %%f in ("%BACKUP_FILE%") do set "BACKUP_SIZE=%%~zf"
        echo [%CURRENT_DATE% %CURRENT_TIME:~0,2%:%CURRENT_TIME:~2,2%:%CURRENT_TIME:~4,2%] 备份文件大小: %BACKUP_SIZE% 字节 >> "%LOG_FILE%"
    ) else (
        echo [%CURRENT_DATE% %CURRENT_TIME:~0,2%:%CURRENT_TIME:~2,2%:%CURRENT_TIME:~4,2%] 警告: 备份文件创建失败，但复制命令未报告错误 >> "%LOG_FILE%"
    )
)

REM 保留最近6个月的备份，删除更早的备份
echo [%CURRENT_DATE% %CURRENT_TIME:~0,2%:%CURRENT_TIME:~2,2%:%CURRENT_TIME:~4,2%] 开始清理旧备份文件（保留最近6个月） >> "%LOG_FILE%"
forfiles /p "%BACKUP_DIR%" /m "sample_management_*.db" /d -180 /c "cmd /c echo 删除旧备份文件: @path && echo [%CURRENT_DATE% %TIME:~0,2%:%TIME:~3,2%:%TIME:~6,2%] 删除旧备份文件: @path >> "%LOG_FILE%" && del @path"
if errorlevel 0 (
    echo [%CURRENT_DATE% %CURRENT_TIME:~0,2%:%CURRENT_TIME:~2,2%:%CURRENT_TIME:~4,2%] 旧备份清理完成 >> "%LOG_FILE%"
) else (
    echo [%CURRENT_DATE% %CURRENT_TIME:~0,2%:%CURRENT_TIME:~2,2%:%CURRENT_TIME:~4,2%] 警告: 旧备份清理过程中出现错误 >> "%LOG_FILE%"
)

REM 显示备份完成信息
echo [%CURRENT_DATE% %CURRENT_TIME:~0,2%:%CURRENT_TIME:~2,2%:%CURRENT_TIME:~4,2%] 数据库备份任务已完成 >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"

REM 非交互式运行时不需要暂停
REM 如果通过任务计划程序运行，不需要暂停
REM 如果手动运行，添加暂停
set "INTERACTIVE=false"
set "CMD=%CMDCMDLINE%"
set "CMD=%CMD: =%"
if "%CMD%"=="%~0" set "INTERACTIVE=true"

if "%INTERACTIVE%"=="true" (
echo 数据库备份完成！
echo 备份文件: %BACKUP_FILE%
echo 日志文件: %LOG_FILE%
pause
)

REM 退出脚本
exit /b 0