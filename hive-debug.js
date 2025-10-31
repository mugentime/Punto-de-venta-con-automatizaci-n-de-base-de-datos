import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '.hive-mind', 'hive.db');
const dbBuffer = fs.readFileSync(dbPath);
const dbString = dbBuffer.toString('utf8');

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║              🐝 HIVE-MIND DEBUG MODE 🐝                       ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Read config
const configPath = path.join(__dirname, '.hive-mind', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('📋 CONFIGURACIÓN DEL SISTEMA:');
console.log('├─ Estado:', config.system.enabled ? '✓ ENABLED' : '✗ DISABLED');
console.log('├─ Auto-start:', config.system.autoStart ? 'SI' : 'NO');
console.log('├─ Queen:', config.queen.name, `(${config.queen.type})`);
console.log('├─ Max Workers:', config.workers.maxWorkers);
console.log('├─ Consenso:', config.consensus.algorithm);
console.log('└─ Inicializado:', new Date(config.initialized).toLocaleString());

console.log('\n🧠 CAPACIDADES DE LA QUEEN:');
config.queen.capabilities.forEach(cap => {
    console.log(`  ✓ ${cap}`);
});

console.log('\n👷 ROLES ESPECIALIZADOS:');
config.workers.specializedRoles.forEach(role => {
    console.log(`  • ${role}`);
});

console.log('\n📊 CANALES DE COMUNICACIÓN:');
config.communication.channels.forEach(channel => {
    console.log(`  📡 ${channel}`);
});

console.log('\n💾 MEMORIA:');
console.log('├─ Estado:', config.memory.enabled ? 'ACTIVA' : 'INACTIVA');
console.log('├─ Tamaño:', config.memory.size);
console.log('├─ Persistencia:', config.memory.persistenceMode);
console.log('├─ Retención:', config.memory.retentionDays, 'días');
console.log('└─ Compresión:', config.memory.compressionEnabled ? 'SI' : 'NO');

// Try to find sessions in the raw data
console.log('\n🔍 BUSCANDO SESIONES EN LA BASE DE DATOS...\n');

// Look for UUID patterns (sessions likely have UUIDs)
const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const uuids = dbString.match(uuidPattern);

if (uuids && uuids.length > 0) {
    const uniqueUuids = [...new Set(uuids)];
    console.log(`📌 IDs encontrados: ${uniqueUuids.length}`);
    uniqueUuids.slice(0, 5).forEach((id, i) => {
        console.log(`  ${i + 1}. ${id}`);
    });
}

// Look for timestamps
const datePattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g;
const dates = dbString.match(datePattern);
if (dates && dates.length > 0) {
    const uniqueDates = [...new Set(dates)];
    console.log(`\n⏰ Timestamps encontrados: ${uniqueDates.length}`);
    uniqueDates.slice(0, 5).forEach((date, i) => {
        console.log(`  ${i + 1}. ${date}`);
    });
}

// Look for status keywords
console.log('\n📈 ESTADOS DETECTADOS:');
const statuses = ['active', 'pending', 'completed', 'paused', 'running', 'failed'];
statuses.forEach(status => {
    const count = (dbString.match(new RegExp(status, 'gi')) || []).length;
    if (count > 0) {
        console.log(`  • ${status}: ${count} menciones`);
    }
});

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  Nota: Para acceso completo, necesitas una herramienta SQLite  ║');
console.log('║  Este es un análisis parcial del archivo binario              ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
