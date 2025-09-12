#!/bin/bash
# Script automatizado: inicia backend, corre Playwright, git push, monitorea Railway logs
set -e

# Instalar netcat si no existe
if ! command -v nc &> /dev/null; then
  echo "Instalando netcat..."
  sudo apt-get update && sudo apt-get install -y netcat
fi

# Configuración
SERVER_CMD="npm start"
SERVER_PORT=3000
TIMEOUT=15
PLAYWRIGHT_CMD="npx playwright test"
GIT_BRANCH="main"

# Iniciar el backend en segundo plano
$SERVER_CMD &
SERVER_PID=$!

# Esperar a que el servidor esté arriba (máx TIMEOUT segundos)
for i in $(seq 1 $TIMEOUT); do
  if nc -z localhost $SERVER_PORT; then
    echo "Servidor iniciado en puerto $SERVER_PORT."
    break
  fi
  sleep 1
done

if ! nc -z localhost $SERVER_PORT; then
  echo "ERROR: El servidor no inició en $TIMEOUT segundos. Abortando workflow."
  kill $SERVER_PID 2>/dev/null || true
  exit 1
fi

# Ejecutar el test de Playwright
$PLAYWRIGHT_CMD || {
  echo "Test Playwright falló. Abortando workflow.";
  kill $SERVER_PID 2>/dev/null || true
  exit 2
}

# Detener el backend
kill $SERVER_PID 2>/dev/null || true

# Git push a main
echo "Realizando git push a $GIT_BRANCH..."
git add .
git commit -m "chore: workflow auto-push tras test playwright"
git push origin $GIT_BRANCH

# Monitorear logs de Railway deployment
echo "Mostrando logs de Railway deployment..."
railway logs --tail 100 || echo "No se pudo obtener logs de Railway. Verifica CLI y credenciales."

echo "Workflow completado exitosamente."
