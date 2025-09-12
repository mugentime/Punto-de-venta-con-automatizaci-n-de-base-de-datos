[CmdletBinding()]
param(
  [int]$Port = 3456,
  [string]$Path = "/warp/",
  [string]$HostName = "localhost",
  [switch]$Speak,
  [ValidateSet("Helena", "Sabina", "Auto")]
  [string]$Voice = "Auto"
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

function Get-BestSpanishVoice {
  try {
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $voices = $synth.GetInstalledVoices()
    
    # Buscar voces españolas por orden de preferencia
    $preferences = @(
      "Microsoft Helena Desktop",  # España
      "Microsoft Sabina Desktop",  # México  
      "Microsoft Laura Desktop",   # España (alternativa)
      "Microsoft Pablo Desktop"    # México (alternativa)
    )
    
    foreach ($prefVoice in $preferences) {
      $found = $voices | Where-Object { $_.VoiceInfo.Name -eq $prefVoice -and $_.Enabled }
      if ($found) {
        Write-Log "✅ Usando voz española: $($found.VoiceInfo.Name) ($($found.VoiceInfo.Culture))"
        return $found.VoiceInfo.Name
      }
    }
    
    # Fallback: cualquier voz que contenga "es-" en culture
    $spanishVoice = $voices | Where-Object { $_.VoiceInfo.Culture.Name -like "es-*" -and $_.Enabled } | Select-Object -First 1
    if ($spanishVoice) {
      Write-Log "⚠️ Usando voz española genérica: $($spanishVoice.VoiceInfo.Name)"
      return $spanishVoice.VoiceInfo.Name
    }
    
    Write-Log "❌ No se encontró ninguna voz española instalada"
    return $null
  } catch {
    Write-Log "❌ Error buscando voces: $($_.Exception.Message)"
    return $null
  }
}

function Speak-SpanishNative {
  param([string]$Text)
  if (-not $Speak -or -not $Text) { return }
  
  Start-Job -ScriptBlock {
    param($message, $voiceName)
    try {
      Add-Type -AssemblyName System.Speech
      $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
      
      # Configurar la voz española si está disponible
      if ($voiceName) {
        try {
          $synth.SelectVoice($voiceName)
        } catch {
          # Si falla, usar cualquier voz española disponible
          $voices = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like "es-*" }
          if ($voices) {
            $synth.SelectVoice($voices[0].VoiceInfo.Name)
          }
        }
      }
      
      # Configuración optimizada para mejor calidad
      $synth.Rate = -1      # Más lento para mejor pronunciación
      $synth.Volume = 90    # Volumen alto pero no al máximo
      
      # Usar Speak (síncrono) en lugar de SpeakAsync para mejor calidad
      $synth.Speak($message)
      $synth.Dispose()
    } catch {
      # Error silencioso para no interrumpir el webhook
    }
  } -ArgumentList $Text, $script:SpanishVoice | Out-Null
}

function Create-SpanishMessage {
  param([string]$Command, [string]$ExitCode, [string]$Output)
  
  # Mensajes más naturales en español
  $messages = @{
    "success" = @(
      "Comando ejecutado correctamente",
      "Tarea completada con éxito", 
      "Comando finalizado sin errores",
      "Operación realizada correctamente"
    )
    "error" = @(
      "Error en el comando",
      "Comando fallido",
      "Se produjo un error",
      "El comando no se ejecutó correctamente"
    )
  }
  
  if ($ExitCode -eq "0" -or $ExitCode -eq "") {
    $baseMessage = $messages["success"] | Get-Random
  } else {
    $baseMessage = $messages["error"] | Get-Random
    $baseMessage += " con código $ExitCode"
  }
  
  # Agregar información específica para comandos conocidos
  $commandLower = $Command.ToLower()
  switch -Wildcard ($commandLower) {
    "*git push*" { 
      if ($ExitCode -eq "0") { $baseMessage += ". Código enviado al repositorio" }
      else { $baseMessage += ". Fallo al enviar código" }
    }
    "*npm install*" { 
      if ($ExitCode -eq "0") { $baseMessage += ". Paquetes instalados" }
      else { $baseMessage += ". Error instalando paquetes" }
    }
    { $_ -like "*dir*" -or $_ -like "*ls*" } { 
      if ($ExitCode -eq "0") { $baseMessage += ". Directorio listado" }
    }
    "*cd*" { 
      if ($ExitCode -eq "0") { $baseMessage += ". Directorio cambiado" }
    }
  }
  
  # Agregar output solo si es corto y útil
  if ($Output -and $Output.Length -gt 0 -and $Output.Length -lt 50) {
    # Limpiar el output de caracteres especiales
    $cleanOutput = $Output -replace '[^\w\s\.\-]', ' ' -replace '\s+', ' '
    if ($cleanOutput.Trim()) {
      $baseMessage += ". $($cleanOutput.Trim())"
    }
  }
  
  return $baseMessage
}

# Inicializar la voz española
$script:SpanishVoice = Get-BestSpanishVoice

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
  Write-Log "🎙️ Servidor webhook iniciado con voz española nativa en $prefix"
  if ($script:SpanishVoice) {
    Write-Log "🔊 Voz configurada: $($script:SpanishVoice)"
  } else {
    Write-Log "⚠️ No hay voces españolas disponibles, usando voz predeterminada"
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
      try {
        $data = $body | ConvertFrom-Json
      } catch {
        Write-Log "JSON inválido recibido"
      }
      
      $command = ""
      $output = ""
      $exitCode = ""
      
      if ($data) {
        $command = if ($data.command) { $data.command } else { "" }
        $output = if ($data.output) { $data.output } else { "" }
        $exitCode = if ($data.exit_code -ne $null) { $data.exit_code.ToString() } else { "" }
      }
      
      Write-Log "[WEBHOOK] Comando: '$command' | Código: $exitCode | Salida: $($output.Length) chars"
      
      # Generar mensaje en español natural
      if ($Speak) {
        $spanishMessage = Create-SpanishMessage -Command $command -ExitCode $exitCode -Output $output
        Write-Log "🎤 TTS: $spanishMessage"
        Speak-SpanishNative -Text $spanishMessage
      }
      
      # Respuesta JSON
      $jsonResponse = @{
        ok = $true
        timestamp = (Get-Date -Format o)
        voice_used = $script:SpanishVoice
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
      Write-Log "Error procesando solicitud: $($_.Exception.Message)"
      $response.StatusCode = 500
    } finally {
      $response.Close()
    }
  }
} catch {
  Write-Log "Error del servidor: $($_.Exception.Message)"
  if ($_.Exception.Message -match 'Access is denied') {
    Write-Log "Ejecutar como Administrador: netsh http add urlacl url=$prefix user=$env:USERNAME"
  }
} finally {
  $listener.Stop()
  $listener.Close()
  Write-Log "Servidor webhook detenido"
}
