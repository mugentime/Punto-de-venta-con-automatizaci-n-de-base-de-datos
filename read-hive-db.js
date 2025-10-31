import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the database file as hex
const dbPath = path.join(__dirname, '.hive-mind', 'hive.db');
const dbBuffer = fs.readFileSync(dbPath);

// SQLite database file format parser (basic)
function parseSQLiteDB(buffer) {
    const header = buffer.toString('utf8', 0, 16);
    console.log('=== HIVE-MIND DEBUG ACCESS ===\n');
    console.log('Database Header:', header);
    console.log('Database Size:', buffer.length, 'bytes');
    console.log('SQLite Version:', buffer.readUInt32BE(96));

    // Try to extract readable strings from the database
    const dbString = buffer.toString('utf8');

    // Look for common patterns
    console.log('\n=== SESIONES ACTIVAS ===');
    const sessionMatches = dbString.match(/session[^\\x00]{0,200}/gi);
    if (sessionMatches) {
        sessionMatches.slice(0, 10).forEach((match, i) => {
            console.log(`${i + 1}. ${match.substring(0, 100)}`);
        });
    }

    console.log('\n=== WORKERS ===');
    const workerMatches = dbString.match(/worker[^\\x00]{0,200}/gi);
    if (workerMatches) {
        workerMatches.slice(0, 10).forEach((match, i) => {
            console.log(`${i + 1}. ${match.substring(0, 100)}`);
        });
    }

    console.log('\n=== TAREAS/TASKS ===');
    const taskMatches = dbString.match(/task[^\\x00]{0,200}/gi);
    if (taskMatches) {
        taskMatches.slice(0, 10).forEach((match, i) => {
            console.log(`${i + 1}. ${match.substring(0, 100)}`);
        });
    }

    console.log('\n=== ESTADO/STATUS ===');
    const statusMatches = dbString.match(/(active|pending|completed|running|paused)[^\\x00]{0,100}/gi);
    if (statusMatches) {
        statusMatches.slice(0, 10).forEach((match, i) => {
            console.log(`${i + 1}. ${match.substring(0, 80)}`);
        });
    }

    // Look for JSON data
    console.log('\n=== DATOS JSON ===');
    const jsonMatches = dbString.match(/\{[^}]{20,300}\}/g);
    if (jsonMatches) {
        jsonMatches.slice(0, 5).forEach((match, i) => {
            try {
                const parsed = JSON.parse(match);
                console.log(`${i + 1}.`, JSON.stringify(parsed, null, 2));
            } catch (e) {
                console.log(`${i + 1}. ${match.substring(0, 100)}...`);
            }
        });
    }
}

try {
    parseSQLiteDB(dbBuffer);
} catch (error) {
    console.error('Error accessing hive-mind database:', error.message);
}
