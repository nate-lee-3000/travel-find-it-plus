<#
  Copies road_trip_spotting_game.json into the embedded data block in index.html.
  Run after editing the JSON so the game also works when index.html is opened
  directly from disk (file://), where browsers block loading the JSON file.

  Usage (from the project folder):  powershell -ExecutionPolicy Bypass -File tools\embed-data.ps1
#>
$root = Split-Path -Parent $PSScriptRoot
$jsonPath = Join-Path $root 'road_trip_spotting_game.json'
$htmlPath = Join-Path $root 'index.html'

$json = Get-Content $jsonPath -Raw -Encoding UTF8
$null = $json | ConvertFrom-Json   # fails loudly on invalid JSON
$safe = $json.Trim() -replace '</', '<\/'

$html = Get-Content $htmlPath -Raw -Encoding UTF8
$pattern = '(?s)(<script type="application/json" id="embedded-game-data">).*?(</script>)'
if ($html -notmatch $pattern) { throw 'Embedded data block not found in index.html' }
$html = [regex]::Replace($html, $pattern, { param($m) $m.Groups[1].Value + "`n" + $safe + "`n" + $m.Groups[2].Value })

[System.IO.File]::WriteAllText($htmlPath, $html, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Embedded $((Get-Item $jsonPath).Length) bytes of game data into index.html"
