param(
    [string]$InputPath,
    [string]$OutputPath
)
$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    $doc = $word.Documents.Open($InputPath, $false, $true)
    $doc.SaveAs2($OutputPath, 16)
    $doc.Close($false)
    Write-Host "OK"
} catch {
    Write-Host "ERROR: $_"
} finally {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
}
