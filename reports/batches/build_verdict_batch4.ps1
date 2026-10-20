$ErrorActionPreference = 'Stop'

$mappingRaw = Get-Content -Path 'D:\RMFOODFP\reports\batches\verdicts_batch4.json' -Encoding utf8 -Raw
$mapping = $mappingRaw | ConvertFrom-Json

$inPath  = 'D:\RMFOODFP\reports\batches\batch_4.jsonl'
$outPath = 'D:\RMFOODFP\reports\batches\batch_4_verdict.jsonl'

$lines = Get-Content -Path $inPath -Encoding utf8
$results = foreach ($line in $lines) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $obj = $line | ConvertFrom-Json
  $id = [string]$obj.id
  $v = $mapping.$id
  if (-not $v) {
    Write-Warning "No mapping for id $id"
    continue
  }
  $obj | Add-Member -NotePropertyName 'verdict' -NotePropertyValue $v.verdict -Force
  $obj | Add-Member -NotePropertyName 'reason'  -NotePropertyValue $v.reason  -Force
  $obj | ConvertTo-Json -Compress -Depth 10
}

$results | Set-Content -Path $outPath -Encoding utf8
Write-Output "Written $($results.Count) verdict lines to $outPath"