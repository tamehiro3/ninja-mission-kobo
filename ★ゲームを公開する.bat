@echo off
chcp 65001 >nul
title CNP にんじゃミッション工房 - 公開ツール
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy_to_github.ps1"
