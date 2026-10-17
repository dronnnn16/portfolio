@echo off
setlocal
title Figma to After Effects - installer

rem Ask for administrator rights (Program Files needs them).
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Administrator permission chahiye. "Yes" dabao...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

set "SRC=%~dp0after-effects\FigmaToAE.jsx"
set "DEST=C:\Program Files\Adobe\Adobe After Effects 2025\Support Files\Scripts\ScriptUI Panels"

if not exist "%SRC%" (
  echo [X] FigmaToAE.jsx nahi mila: "%SRC%"
  echo     Ye file figma-to-ae folder ke andar se hi chalao.
  pause
  exit /b 1
)
if not exist "C:\Program Files\Adobe\Adobe After Effects 2025\" (
  echo [X] After Effects 2025 nahi mila: C:\Program Files\Adobe\Adobe After Effects 2025
  pause
  exit /b 1
)

if not exist "%DEST%" mkdir "%DEST%"
copy /Y "%SRC%" "%DEST%\" >nul
if %errorlevel% neq 0 (
  echo [X] Copy fail ho gaya. After Effects band karke dobara chalao.
  pause
  exit /b 1
)

echo.
echo [OK] FigmaToAE.jsx install ho gaya:
echo      %DEST%
echo.
echo Ab:
echo   1. After Effects kholo (pehle se khula ho to band karke dobara kholo)
echo   2. Edit ^> Preferences ^> Scripting ^& Expressions ^>
echo      "Allow Scripts to Write Files and Access Network" tick karo
echo   3. Window ^> FigmaToAE.jsx
echo.
pause
