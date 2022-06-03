if(!$env:SCOOP_HOME) { $env:SCOOP_HOME = (scoop prefix scoop) }
$checkver = "$env:SCOOP_HOME/bin/checkver.ps1"
$dir = "$psscriptroot/../bucket" # checks the parent dir
Invoke-Expression -command "& '$checkver' -dir '$dir' $($args | ForEach-Object { "$_ " })"
Invoke-Expression -command "& '$checkver' -dir '$psscriptroot/../experimental' $($args | ForEach-Object { "$_ " })"
