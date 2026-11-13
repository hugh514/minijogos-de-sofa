#Requires -Version 7
# Monta dist/minijogos-de-sofa-windows.zip a partir do que esta commitado (git archive HEAD), com o three.js
# do lockfile e um node.exe oficial conferido por um SHA-256 fixado aqui.
# Uso: pwsh scripts/empacotar.ps1
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Versoes aceitas e o SHA-256 oficial de cada zip (de https://nodejs.org/dist/v<versao>/SHASUMS256.txt).
# Fixar o hash aqui protege contra um zip e um SHASUMS trocados juntos no servidor.
$NODE_VERSAO = '26.12.1'
$NODE_SHA256 = 'b3efd5c70cba3308ed46e7e699a9b8aac075bbc6b027fcb39c84c31acc25e2b4'
$THREE_VERSAO = '0.187.0'

$raiz = Split-Path -Parent $PSScriptRoot
Push-Location $raiz
try {
  if (git status --porcelain) { throw 'Ha mudancas nao commitadas. Commite ou descarte antes de empacotar.' }

  $dist = Join-Path $raiz 'dist'
  $tmp = Join-Path $dist 'tmp'
  $pacote = Join-Path $tmp 'minijogos-de-sofa'
  Remove-Item $dist -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force $pacote | Out-Null

  # 1. Fonte: so o que esta no commit atual (nada de rascunho da pasta de trabalho)
  $fonte = Join-Path $tmp 'fonte'
  New-Item -ItemType Directory -Force $fonte | Out-Null
  git archive --format=tar -o (Join-Path $tmp 'fonte.tar') HEAD
  tar -xf (Join-Path $tmp 'fonte.tar') -C $fonte

  foreach ($a in 'server.js', 'tela.html', 'controle.html', 'logica.mjs', 'JOGAR.bat', 'LICENSE', 'package.json') {
    Copy-Item (Join-Path $fonte $a) $pacote
  }
  Copy-Item (Join-Path $fonte 'jogos') $pacote -Recurse
  Get-ChildItem (Join-Path $pacote 'jogos') -Filter '*.test.mjs' | Remove-Item
  Get-ChildItem (Join-Path $pacote 'jogos') -Filter '_*' | Remove-Item
  @"
Minijogos de Sofa
=================

1. Extraia este zip inteiro numa pasta (nao abra o JOGAR.bat de dentro do zip).
2. De dois cliques em JOGAR.bat. Se o Windows avisar sobre arquivo baixado da internet,
   clique em "Mais informacoes" e "Executar assim mesmo".
3. Se o firewall perguntar, permita o Node em rede privada, para os celulares conectarem.
4. Nos celulares, no mesmo Wi-Fi, leia o QR code da tela ou abra o endereco que aparece.

Projeto, prints e codigo: https://github.com/hugh514/minijogos-de-sofa
Licencas: LICENSE (o jogo), node\LICENSE (Node.js), node_modules\three\LICENSE (three.js).
"@ | Set-Content (Join-Path $pacote 'LEIA-ME.txt') -Encoding utf8

  # 2. three.js na versao do lockfile
  $three = Join-Path $raiz 'node_modules\three'
  $versaoThree = (Get-Content (Join-Path $three 'package.json') -Raw | ConvertFrom-Json).version
  if ($versaoThree -ne $THREE_VERSAO) { throw "three.js local e $versaoThree, esperado $THREE_VERSAO. Rode npm ci." }
  $destThree = Join-Path $pacote 'node_modules\three'
  New-Item -ItemType Directory -Force (Join-Path $destThree 'build') | Out-Null
  Copy-Item (Join-Path $three 'build\three.module.js'), (Join-Path $three 'build\three.core.js') (Join-Path $destThree 'build')
  Copy-Item (Join-Path $three 'LICENSE'), (Join-Path $three 'package.json') $destThree

  # 3. Node oficial, conferido pelo hash fixado
  $nomeZip = "node-v$NODE_VERSAO-win-x64.zip"
  $zipNode = Join-Path $tmp $nomeZip
  Invoke-WebRequest "https://nodejs.org/dist/v$NODE_VERSAO/$nomeZip" -OutFile $zipNode
  $obtido = (Get-FileHash $zipNode -Algorithm SHA256).Hash.ToLower()
  if ($obtido -ne $NODE_SHA256) { throw "SHA-256 do Node nao confere: $obtido" }
  Expand-Archive $zipNode -DestinationPath $tmp
  $pastaNode = Join-Path $tmp "node-v$NODE_VERSAO-win-x64"
  New-Item -ItemType Directory -Force (Join-Path $pacote 'node') | Out-Null
  Copy-Item (Join-Path $pastaNode 'node.exe'), (Join-Path $pastaNode 'LICENSE') (Join-Path $pacote 'node')

  # 4. Zip final
  $saida = Join-Path $dist 'minijogos-de-sofa-windows.zip'
  Compress-Archive -Path $pacote -DestinationPath $saida -CompressionLevel Optimal
  Remove-Item $tmp -Recurse -Force
  Get-Item $saida | Select-Object Name, @{ n = 'MB'; e = { [math]::Round($_.Length / 1MB, 1) } }
} finally {
  Pop-Location
}
