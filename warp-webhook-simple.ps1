[CmdletBinding()]
param(
  [int]$Port = 3456,
  [string]$Path = "/warp/",
  [string]$HostName = "localhost",
  [switch]$Speak
)

$prefix = "http://${HostName}:${Port}${Path}"
$ScriptDir = $PWD.Path
$LogPath = Join-Path $ScriptDir "warp-webhook.log"

function Write-Log {
  param([string]$Message)
  $line = "{0} {1}" -f (Get-Date -Format o), $Message
  Add-Content -Path $LogPath -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
  Write-Host $line
}

function Speak-Spanish {
  param([string]$Text)
  if ($Speak -and $Text) {
    try {
      # Use PowerShell's built-in speech capability
      Add-Type -AssemblyName System.Speech
      $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
      $synth.Rate = 0
      $synth.Volume = 80
      $synth.Speak($Text)
    } catch {
      Write-Log "TTS Error: $($_.Exception.Message)"
    }
  }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
  Write-Log "Warp webhook server started on $prefix"
  Write-Log "Use -Speak parameter to enable Spanish voice responses"
  
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    
    try {
      if ($request.HttpMethod -ne "POST") {
        $response.StatusCode = 405
        $response.Close()
        continue
      }
      
      # Read the JSON payload
      $reader = New-Object System.IO.StreamReader($request.InputStream)
      $body = $reader.ReadToEnd()
      $reader.Close()
      
      $data = $null
      try {
        $data = $body | ConvertFrom-Json
      } catch {
        Write-Log "Invalid JSON received: $body"
      }
      
      # Extract command info
      $command = ""
      $output = ""
      $exitCode = ""
      
      if ($data) {
        $command = if ($data.command) { $data.command } else { "" }
        $output = if ($data.output) { $data.output } else { "" }
        $exitCode = if ($data.exit_code -ne $null) { $data.exit_code } else { "" }
      }
      
      Write-Log "[WEBHOOK] Command: '$command' | Exit: $exitCode | Output Length: $($output.Length)"
      
      # Spanish voice response
      if ($Speak) {
        $message = "Comando completado"
        if ($exitCode -ne "" -and $exitCode -ne "0") {
          $message = "Comando completado con error $exitCode"
        }
        if ($output -and $output.Length -gt 0 -and $output.Length -lt 100) {
          $message += ". $output"
        }
        
        Start-Job -ScriptBlock {
          param($msg)
          try {
            Add-Type -AssemblyName System.Speech
            $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
            $synth.Rate = 0
            $synth.Volume = 80
            $synth.Speak($msg)
          } catch { }
        } -ArgumentList $message | Out-Null
      }
      
      # Send response
      $jsonResponse = @{
        ok = $true
        timestamp = (Get-Date -Format o)
        received = @{
          command = $command
          exit_code = $exitCode
          output_length = $output.Length
        }
      } | ConvertTo-Json
      
      $buffer = [Text.Encoding]::UTF8.GetBytes($jsonResponse)
      $response.ContentType = "application/json"
      $response.ContentLength64 = $buffer.Length
      $response.OutputStream.Write($buffer, 0, $buffer.Length)
      $response.StatusCode = 200
      
    } catch {
      Write-Log "Request error: $($_.Exception.Message)"
      $response.StatusCode = 500
    } finally {
      $response.Close()
    }
  }
} catch {
  Write-Log "Server error: $($_.Exception.Message)"
  if ($_.Exception.Message -match 'Access is denied') {
    Write-Log "Run as Administrator: netsh http add urlacl url=$prefix user=$env:USERNAME"
  }
} finally {
  $listener.Stop()
  $listener.Close()
  Write-Log "Webhook server stopped"
}
