@echo off
echo 正在执行研发样品管理系统自动备份...
cd /d D:\sample-management-system\project
node backup_restore.js backup
echo 备份完成！
echo 按任意键退出...
pause