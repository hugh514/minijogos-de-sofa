# Monta dist/minijogos-de-sofa-windows.zip: o jogo, o three.js e um node.exe oficial com a licenca dele.
# Uso: pwsh scripts/empacotar.ps1 [-NodeVersion 26.12.1]
param([string]$NodeVersion = '26.12.1')
$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $raiz 'dist'
$tmp = Join-Path $dist 'tmp'
$pacote = Join-Path $tmp 'minijogos-de-sofa'
Remove-Item $dist -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $pacote | Out-Null

# 1. Node oficial, conferido pelo SHA-256 publicado pelo projeto
$nomeZip = "node-v$NodeVersion-win-x64.zip"
$base = "https://nodejs.org/dist/v$NodeVersion"
$zipNode = Join-Path $tmp $nomeZip
Invoke-WebRequest "$base/$nomeZip" -OutFile $zipNode
$somas = (Invoke-WebRequest "$base/SHASUMS256.txt").Content
$esperado = ($somas -split "`n" | Where-Object { $_ -match [regex]::Escape($nomeZip) + '$' }) -split '\s+' | Select-Object -First 1
$obtido = (Get-FileHash $zipNode -Algorithm SHA256).Hash.ToLower()
if (-not $esperado -or $obtido -ne $esperado.ToLower()) { throw "SHA-256 do Node nao confere ($obtido)" }
Expand-Archive $zipNode -DestinationPath $tmp
$pastaNode = Join-Path $tmp "node-v$NodeVersion-win-x64"
New-Item -ItemType Directory -Force (Join-Path $pacote 'node') | Out-Null
Copy-Item (Join-Path $pastaNode 'node.exe'), (Join-Path $pastaNode 'LICENSE') (Join-Path $pacote 'node')

# 2. O jogo e o three.js (so o build que o servidor usa, mais a licenca)
$arquivos = 'server.js', 'tela.html', 'controle.html', 'logica.mjs', 'JOGAR.bat', 'README.md', 'LICENSE', 'package.json'
foreach ($a in $arquivos) { Copy-Item (Join-Path $raiz $a) $pacote }
Copy-Item (Join-Path $raiz 'jogos') $pacote -Recurse
Get-ChildItem (Join-Path $pacote 'jogos') -Filter '*.test.mjs' | Remove-Item
Remove-Item (Join-Path $pacote 'jogos\_teste.mjs') -ErrorAction SilentlyContinue
$three = Join-Path $raiz 'node_modules\three'
if (-not (Test-Path (Join-Path $three 'build\three.module.js'))) { throw 'Rode npm install antes de empacotar' }
$destThree = Join-Path $pacote 'node_modules\three'
New-Item -ItemType Directory -Force (Join-Path $destThree 'build') | Out-Null
Copy-Item (Join-Path $three 'build\three.module.js'), (Join-Path $three 'build\three.core.js') (Join-Path $destThree 'build')
Copy-Item (Join-Path $three 'LICENSE'), (Join-Path $three 'package.json') $destThree

# 3. Zip final
Compress-Archive -Path $pacote -DestinationPath (Join-Path $dist 'minijogos-de-sofa-windows.zip') -CompressionLevel Optimal
Remove-Item $tmp -Recurse -Force
Get-Item (Join-Path $dist 'minijogos-de-sofa-windows.zip') | Select-Object Name, @{n = 'MB'; e = { [math]::Round($_.Length / 1MB, 1) } }
