[CmdletBinding()]
param(
  [int]$Port = 3456,
  [string]$Path = "/warp/",
  [string]$HostName = "localhost",
  [switch]$Speak
)

# Allow env overrides
if ($env:WARP_WEBHOOK_PORT) { $Port = [int]$env:WARP_WEBHOOK_PORT }
if ($env:WARP_WEBHOOK_PATH) { $Path = $env:WARP_WEBHOOK_PATH }
if ($env:WARP_WEBHOOK_HOST) { $HostName = $env:WARP_WEBHOOK_HOST }
$EnableSpeech = $Speak.IsPresent
if ($env:WARP_SPEAK) { if ($env:WARP_SPEAK -match '^(1|true|yes)$') { $EnableSpeech = $true } else { $EnableSpeech = $false } }

# Normalize path to start and end with "/"
if (-not $Path.StartsWith("/")) { $Path = "/" + $Path }
if (-not $Path.EndsWith("/")) { $Path = $Path + "/" }

$prefix = "http://${HostName}:${Port}${Path}"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }
$LogPath = Join-Path $ScriptDir "warp-webhook.log"

function Write-Log {
  param([string]$Message)
  $line = "{0} {1}" -f (Get-Date -Format o), $Message
  try { Add-Content -Path $LogPath -Value $line -Encoding UTF8 } catch {}
  Write-Host $line
}

function Remove-Ansi {
  param([string]$Text)
  if (-not $Text) { return $Text }
  $ansi = [regex]"`e\[[0-9;?]*[ -/]*[@-~]"
  $clean = $ansi.Replace($Text, "")
  $clean = ($clean -replace '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', ' ')
  $clean = ($clean -replace '\s+', ' ').Trim()
  return $clean
}

function First {
  param([object[]]$Items)
  foreach ($i in $Items) { if ($null -ne $i -and "$i" -ne "") { return $i } }
  return $null
}

function Summarize {
  param([string]$Text, [int]$MaxChars = 300)
  if (-not $Text) { return $Text }
  $t = $Text.Trim()
  if ($t.Length -le $MaxChars) { return $t }
  return ($t.Substring(0, $MaxChars) + " ...")
}

function Speak-Es {
  param([string]$Text)
  try {
    Add-Type -AssemblyName System.Speech -ErrorAction Stop
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    
    # Try to find a Spanish voice first
    $voices = $synth.GetInstalledVoices()
    $spanishVoice = $voices | Where-Object { $_.VoiceInfo.Culture.Name -like "es*" } | Select-Object -First 1
    if ($spanishVoice) {
      $synth.SelectVoice($spanishVoice.VoiceInfo.Name)
    }
    
    $synth.Rate = 0
    $synth.Volume = 100
    $result = $synth.SpeakAsync($Text)
    # Don't wait for completion to avoid blocking
  } catch {
    Write-Log "TTS error: $($_.Exception.Message)"
  }
}

$listener = New-Object System.Net.HttpListener
$listener.AuthenticationSchemes = [System.Net.AuthenticationSchemes]::Anonymous
$listener.IgnoreWriteExceptions = $true
$listener.Prefixes.Clear()
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
  Write-Log "Warp webhook listening on $prefix"
  Write-Log "If you get 'Access is denied', run elevated: netsh http add urlacl url=$prefix user=$env:USERNAME"
} catch {
  Write-Log "Failed to start HttpListener on ${prefix}: $($_.Exception.Message)"
  if ($_.Exception.Message -match 'Access is denied') {
    Write-Log "Run as Administrator: netsh http add urlacl url=${prefix} user=$env:USERNAME"
  }
  throw
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $req = $context.Request
      $res = $context.Response

      if ($req.HttpMethod -ne "POST") {
        $res.StatusCode = 405
        $res.StatusDescription = "Method Not Allowed"
        $res.Close()
        continue
      }

      $reader = New-Object System.IO.StreamReader($req.InputStream, $req.ContentEncoding)
      $raw = $reader.ReadToEnd()
      $reader.Close()

      $json = $null
      try { $json = $raw | ConvertFrom-Json -Depth 32 } catch {}

      $eventName = $null
      $command   = $null
      $output    = $null
      $exitCode  = $null
      $duration  = $null

      if ($json) {
        $eventName = (First @($json.event, $json.type, $json.Event, $json.kind))
        $command   = (First @($json.command, $json.Command, $json.data.command, $json.block.command, $json.metadata.command))
        $output    = (First @($json.output, $json.stdout, $json.block_text, $json.text, $json.data.output, $json.block.text))
        $exitCode  = (First @($json.exit_code, $json.code, $json.status, $json.status_code))
        $duration  = (First @($json.duration_ms, $json.data.duration_ms, $json.duration))
      }

      $clean = Remove-Ansi $output
      $summary = Summarize $clean 300
      $len = if ($output) { $output.Length } else { 0 }

      Write-Log ("[event={0}] cmd='{1}' exit={2} duration_ms={3} len={4}" -f $eventName, $command, $exitCode, $duration, $len)

      if ($EnableSpeech) {
        try {
          $speak = "Comando completado"
          if ($exitCode -ne $null -and "$exitCode" -ne "") { $speak = "Comando completado con código de salida $exitCode" }
          if ($summary) { $speak = "$speak. Resumen: $summary" }
          Speak-Es -Text $speak
        } catch {
          Write-Log "Speech error: $($_.Exception.Message)"
        }
      }

      $resp = @{
        ok = $true
        received = @{
          event = $eventName
          command = $command
          exit_code = $exitCode
          duration_ms = $duration
        }
        ts = (Get-Date -Format o)
      } | ConvertTo-Json -Depth 5

      $bytes = [Text.Encoding]::UTF8.GetBytes($resp)
      $res.StatusCode = 200
      $res.ContentType = "application/json"
      $res.ContentEncoding = [Text.Encoding]::UTF8
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      $res.Close()
    } catch {
      try {
        $err = @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json
        $bytes = [Text.Encoding]::UTF8.GetBytes($err)
        $context.Response.StatusCode = 500
        $context.Response.ContentType = "application/json"
        $context.Response.ContentLength64 = $bytes.Length
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        $context.Response.Close()
      } catch {}
      Write-Log "Request error: $($_.Exception.Message)"
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
  Write-Log "Warp webhook listener stopped."
}
