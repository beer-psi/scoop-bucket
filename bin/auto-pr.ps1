param(
    # overwrite upstream param
    [String]$upstream = "beerpiss/scoop-bucket:main"
)

if(!$env:SCOOP_HOME) { $env:SCOOP_HOME = Resolve-Path (scoop prefix scoop) }
$autopr = "$env:SCOOP_HOME/bin/auto-pr.ps1"
Invoke-Expression -command "& '$autopr' -upstream $upstream $($args | ForEach-Object { "$_ " })"
