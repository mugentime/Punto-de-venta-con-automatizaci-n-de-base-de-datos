/**
 * 🔧 TaskMaster: Debug script para analizar registros y fechas
 */

const databaseManager = require('./utils/databaseManager');
const fs = require('fs').promises;
const path = require('path');

class RecordAnalyzer {
    async analyzeRecords() {
        console.log('🔍 TaskMaster: Analizando registros para debug...');
        
        try {
            const allRecords = await databaseManager.getRecords();
            console.log(`📊 Total records: ${allRecords.length}`);
            
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            
            console.log(`📅 Today: ${today.toISOString()}`);
            console.log(`📅 Start of day: ${startOfDay.toISOString()}`);
            
            console.log('\n📋 Análisis de records por fecha:');
            
            allRecords.forEach((record, index) => {
                const recordDate = record.date ? new Date(record.date) : null;
                const inToday = recordDate && recordDate >= startOfDay && recordDate < today;
                
                console.log(`\n Record ${index + 1}:`);
                console.log(`   ID: ${record.id || record._id || 'No ID'}`);
                console.log(`   Date: ${record.date || 'No date'}`);
                console.log(`   Parsed Date: ${recordDate ? recordDate.toISOString() : 'Invalid'}`);
                console.log(`   Total: $${record.total || 0}`);
                console.log(`   Cost: $${record.cost || 0}`);
                console.log(`   Service: ${record.service || 'N/A'}`);
                console.log(`   Payment: ${record.payment || 'N/A'}`);
                console.log(`   Is Deleted: ${record.isDeleted || false}`);
                console.log(`   In today's range: ${inToday}`);
                
                if (record.id && record.id.includes('DATA-TRANSFER-TEST')) {
                    console.log(`   ⚠️  TEST RECORD DETECTED`);
                }
            });
            
            console.log('\n🔍 Filtrado para hoy:');
            const todayRecords = allRecords.filter(record => {
                if (!record.date) return false;
                const recordDate = new Date(record.date);
                return recordDate >= startOfDay && recordDate < today && !record.isDeleted;
            });
            
            console.log(`📊 Records para hoy: ${todayRecords.length}`);
            const totalIncome = todayRecords.reduce((sum, r) => sum + (r.total || 0), 0);
            const totalCost = todayRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
            
            console.log(`💰 Total ingresos hoy: $${totalIncome}`);
            console.log(`💸 Total costos hoy: $${totalCost}`);
            console.log(`📈 Total ganancia hoy: $${totalIncome - totalCost}`);
            
        } catch (error) {
            console.error('❌ Error analizando registros:', error);
        }
    }
}

// Ejecutar análisis
const analyzer = new RecordAnalyzer();
analyzer.analyzeRecords();
