[CmdletBinding()]
param(
  [int]$Port = 3456,
  [string]$Path = "/warp/",
  [string]$HostName = "localhost",
  [switch]$Speak
)

$prefix = "http://${HostName}:${Port}${Path}"
$LogPath = Join-Path $PWD.Path "warp-webhook.log"

function Write-Log {
  param([string]$Message)
  $line = "{0} {1}" -f (Get-Date -Format o), $Message
  Add-Content -Path $LogPath -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
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
      
      # Buscar y seleccionar voz española
      $voices = $synth.GetInstalledVoices()
      $spanishVoice = $voices | Where-Object { 
        $_.VoiceInfo.Culture.Name -like "es-*" -and $_.Enabled 
      } | Select-Object -First 1
      
      if ($spanishVoice) {
        $synth.SelectVoice($spanishVoice.VoiceInfo.Name)
      }
      
      # Configuración para mejor calidad
      $synth.Rate = -2     # Más lento
      $synth.Volume = 85   # Volumen moderado
      
      $synth.Speak($message)
      $synth.Dispose()
    } catch {
      # Error silencioso
    }
  } -ArgumentList $Text | Out-Null
}

function Create-Message {
  param($Command, $ExitCode, $Output)
  
  if ($ExitCode -eq "0" -or $ExitCode -eq "") {
    $msg = "Comando ejecutado correctamente"
  } else {
    $msg = "Error en comando, código $ExitCode"
  }
  
  # Agregar contexto específico
  if ($Command -like "*git push*") {
    $msg += if ($ExitCode -eq "0") { ". Código enviado" } else { ". Fallo en envío" }
  }
  elseif ($Command -like "*npm*") {
    $msg += if ($ExitCode -eq "0") { ". Paquetes procesados" } else { ". Error con paquetes" }
  }
  elseif ($Command -like "*dir*" -or $Command -like "*ls*") {
    $msg += ". Directorio mostrado"
  }
  
  # Agregar salida corta si existe
  if ($Output -and $Output.Length -gt 0 -and $Output.Length -lt 40) {
    $cleanOutput = $Output -replace '[^\w\s\.]', '' -replace '\s+', ' '
    if ($cleanOutput.Trim()) {
      $msg += ". $($cleanOutput.Trim())"
    }
  }
  
  return $msg
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
  Write-Log "🎙️ Webhook español iniciado en $prefix"
  
  # Verificar voces españolas disponibles
  Add-Type -AssemblyName System.Speech
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $spanishVoices = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like "es-*" }
  
  if ($spanishVoices) {
    Write-Log "🔊 Voces españolas encontradas: $($spanishVoices.Count)"
    foreach ($voice in $spanishVoices) {
      Write-Log "   - $($voice.VoiceInfo.Name) ($($voice.VoiceInfo.Culture))"
    }
  } else {
    Write-Log "⚠️ No se encontraron voces españolas nativas"
  }
  
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
      
      Write-Log "[WEBHOOK] '$command' | Código: $exitCode | Salida: $($output.Length) chars"
      
      # Generar y reproducir mensaje en español
      if ($Speak) {
        $message = Create-Message -Command $command -ExitCode $exitCode -Output $output
        Write-Log "🎤 Reproduciendo: $message"
        Speak-Spanish -Text $message
      }
      
      # Respuesta
      $jsonResponse = @{
        ok = $true
        timestamp = (Get-Date -Format o)
        received = @{
          command = $command
          exit_code = $exitCode
        }
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
