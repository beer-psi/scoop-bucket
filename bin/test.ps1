#Requires -Modules @{ ModuleName = 'Pester'; MaximumVersion = '4.99' }

if(!$env:SCOOP_HOME) { $env:SCOOP_HOME = resolve-path (split-path (split-path (scoop which scoop))) }
$result = Invoke-Pester "$psscriptroot/.." -PassThru
exit $result.FailedCount
