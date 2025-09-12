[CmdletBinding()]
param(
  [int]$Port = 3456,
  [switch]$Speak
)

$prefix = "http://localhost:$Port/warp/"

function Write-Log {
  param([string]$Message)
  $line = "{0} {1}" -f (Get-Date -Format o), $Message
  Write-Host $line
}

function Speak-Spanish {
  param([string]$Text)
  if (-not $Speak -or -not $Text) { return }
  
  Start-Job -ScriptBlock {
    param($message)
    try {
      Add-Type -AssemblyName System.Speech
      $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
      
      # Buscar voz espanola
      $voices = $synth.GetInstalledVoices()
      $spanishVoice = $voices | Where-Object { 
        $_.VoiceInfo.Culture.Name -like "es-*" -and $_.Enabled 
      } | Select-Object -First 1
      
      if ($spanishVoice) {
        $synth.SelectVoice($spanishVoice.VoiceInfo.Name)
      }
      
      $synth.Rate = -2
      $synth.Volume = 90
      $synth.Speak($message)
      $synth.Dispose()
    } catch {
      # Error silencioso
    }
  } -ArgumentList $Text | Out-Null
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
  Write-Log "Webhook iniciado en $prefix con voz espanola"
  
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
      
      $reader = New-Object System.IO.StreamReader($request.InputStream)
      $body = $reader.ReadToEnd()
      $reader.Close()
      
      $data = $null
      try { $data = $body | ConvertFrom-Json } catch { }
      
      $command = if ($data.command) { $data.command } else { "" }
      $output = if ($data.output) { $data.output } else { "" }
      $exitCode = if ($data.exit_code -ne $null) { $data.exit_code.ToString() } else { "" }
      
      Write-Log "[WEBHOOK] Comando: $command | Codigo: $exitCode"
      
      if ($Speak) {
        $message = "Comando ejecutado"
        if ($exitCode -eq "0") {
          $message = "Comando completado exitosamente"
        } elseif ($exitCode -ne "" -and $exitCode -ne "0") {
          $message = "Comando fallo con error $exitCode"
        }
        
        if ($command -like "*git*") {
          $message += " en git"
        } elseif ($command -like "*npm*") {
          $message += " en npm"
        }
        
        Write-Log "Hablando: $message"
        Speak-Spanish -Text $message
      }
      
      $jsonResponse = @{
        ok = $true
        timestamp = (Get-Date -Format o)
      } | ConvertTo-Json
      
      $buffer = [Text.Encoding]::UTF8.GetBytes($jsonResponse)
      $response.ContentType = "application/json"
      $response.ContentLength64 = $buffer.Length
      $response.OutputStream.Write($buffer, 0, $buffer.Length)
      $response.StatusCode = 200
      
    } catch {
      Write-Log "Error: $($_.Exception.Message)"
      $response.StatusCode = 500
    } finally {
      $response.Close()
    }
  }
} catch {
  Write-Log "Error del servidor: $($_.Exception.Message)"
} finally {
  $listener.Stop()
  $listener.Close()
  Write-Log "Servidor detenido"
}
