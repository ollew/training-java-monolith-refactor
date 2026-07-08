param(
  [string]$BaseUrl = 'http://localhost:9080'
)

function Read-ExpectedJson($path) {
  return Get-Content -Raw $path | ConvertFrom-Json
}

function Invoke-ExpectingError([ScriptBlock]$call) {
  try {
    & $call
    return @{ ok = $false; status = 200; body = $null }
  } catch {
    $resp = $_.Exception.Response
    if (-not $resp) {
      return @{ ok = $false; status = 0; body = $_.Exception.Message }
    }
    $status = $resp.StatusCode.value__
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $bodyText = $reader.ReadToEnd()
    return @{ ok = $true; status = $status; body = $bodyText }
  }
}

Write-Host "Running users-service acceptance tests against $BaseUrl`n"

# Test 1: Create user (expected success)
$createReq = Read-ExpectedJson "expected/create_user_request.json"
try {
  $createResp = Invoke-RestMethod -Method Post -Uri ("$BaseUrl/api/users") -ContentType 'application/json' -Body (ConvertTo-Json $createReq)
  if ($createResp.email -eq $createReq.email -and $createResp.name -eq $createReq.name) {
    Write-Host "[PASS] Create user"
  } else {
    Write-Host "[FAIL] Create user - response did not match expected fields"
    Write-Host (ConvertTo-Json $createResp -Depth 5)
    exit 1
  }
} catch {
  Write-Host "[ERROR] Create user - $($_.Exception.Message)"
  exit 2
}

# Test 2: Duplicate create (expected 409)
Write-Host "Testing duplicate-create (expect 409)..."
$dupCall = { Invoke-WebRequest -Method Post -Uri ("$BaseUrl/api/users") -ContentType 'application/json' -Body (ConvertTo-Json $createReq) -UseBasicParsing -ErrorAction Stop }
$dupResult = Invoke-ExpectingError $dupCall
if ($dupResult.ok -and $dupResult.status -eq 409) {
  try {
    $bodyObj = $dupResult.body | ConvertFrom-Json
    if ($bodyObj.message -like '*Email*') {
      Write-Host "[PASS] Duplicate create returned 409 with friendly message"
    } else {
      Write-Host "[WARN] Duplicate create 409 but message didn't match expectation"
      Write-Host $dupResult.body
    }
  } catch {
    Write-Host "[PASS] Duplicate create returned 409; non-JSON body:"
    Write-Host $dupResult.body
  }
} else {
  Write-Host "[FAIL] Duplicate create - expected HTTP 409, got $($dupResult.status)"
  if ($dupResult.body) { Write-Host $dupResult.body }
  exit 3
}

Write-Host "All tests completed."
