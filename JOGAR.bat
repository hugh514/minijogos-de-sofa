@echo off
chcp 65001 >nul
title Minijogos de Sofa
cd /d "%~dp0"

rem Usa o Node que vem no pacote (pasta node\). Se nao tiver, usa o Node instalado no PC.
set "NODE=node"
if exist "%~dp0node\node.exe" set "NODE=%~dp0node\node.exe"

"%NODE%" --version >nul 2>&1
if errorlevel 1 (
  echo Nao achei o Node.js. Baixe o pacote pronto na pagina de Releases do projeto
  echo ou instale o Node.js em https://nodejs.org e abra este arquivo de novo.
  pause
  exit /b 1
)

if not exist "node_modules\three\build\three.module.js" (
  echo Primeira vez: instalando o three.js...
  call npm install --omit=dev
  if errorlevel 1 (
    echo Nao consegui instalar. Confira a internet e tente de novo.
    pause
    exit /b 1
  )
)

echo.
echo  Minijogos de Sofa
echo  -----------------
echo  A tela do jogo vai abrir no navegador.
echo  Nos celulares (mesmo Wi-Fi), abra o endereco que aparece abaixo, ou leia o QR code da tela.
echo  Para desligar, feche esta janela.
echo.
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:8080"
"%NODE%" server.js
echo.
echo O servidor parou. Se apareceu erro acima, abra uma issue no GitHub com um print.
pause
