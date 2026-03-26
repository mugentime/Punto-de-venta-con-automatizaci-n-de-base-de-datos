// Check production API for sessions
const https = require('https');

async function checkProductionAPI() {
  console.log('🔍 Checking production API for coworking sessions...\n');

  // Try common Railway URLs
  const possibleUrls = [
    'punto-de-venta-con-automatizaci-n-de-base-de-datos-production.up.railway.app',
    'punto-de-venta-production.up.railway.app'
  ];

  for (const hostname of possibleUrls) {
    console.log(`Trying: https://${hostname}/api/coworking-sessions`);

    const options = {
      hostname,
      path: '/api/coworking-sessions?limit=100',
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };

    try {
      const result = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let body = '';

          res.on('data', (chunk) => {
            body += chunk;
          });

          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve({ success: true, data: body, hostname });
            } else {
              resolve({ success: false, statusCode: res.statusCode });
            }
          });
        });

        req.on('error', (error) => {
          resolve({ success: false, error: error.message });
        });

        req.setTimeout(10000, () => {
          req.destroy();
          resolve({ success: false, error: 'timeout' });
        });

        req.end();
      });

      if (result.success) {
        console.log('✅ Connected successfully!\n');

        const sessions = JSON.parse(result.data);
        console.log(`📊 Total sessions found: ${sessions.length}\n`);

        // Filter for March 20-25, 2026
        const targetSessions = sessions.filter(s => {
          const startTime = new Date(s.startTime);
          return startTime >= new Date('2026-03-20T00:00:00.000Z') &&
                 startTime <= new Date('2026-03-25T23:59:59.999Z');
        });

        console.log(`📅 Sessions between March 20-25: ${targetSessions.length}\n`);

        if (targetSessions.length === 0) {
          console.log('❌ No sessions found in this date range.');
          console.log('\nThe sessions were never saved to the production database.');
          return;
        }

        // Group by date
        const byDate = {};
        targetSessions.forEach(session => {
          const date = new Date(session.startTime).toISOString().split('T')[0];
          if (!byDate[date]) {
            byDate[date] = [];
          }
          byDate[date].push(session);
        });

        console.log('📅 Sessions by date:\n');
        Object.keys(byDate).sort().forEach(date => {
          const dateSessions = byDate[date];
          console.log(`\n${date} (${dateSessions.length} sessions):`);
          dateSessions.forEach((s, i) => {
            const startTime = new Date(s.startTime).toLocaleString('es-MX');
            const endTime = s.endTime ? new Date(s.endTime).toLocaleString('es-MX') : 'Active';
            console.log(`  ${i + 1}. ${s.clientName || 'Sin nombre'}`);
            console.log(`     Inicio: ${startTime}`);
            console.log(`     Fin: ${endTime}`);
            console.log(`     Estado: ${s.status}`);
            console.log(`     Total: $${s.total || 0}`);
            console.log(`     ID: ${s.id}`);
          });
        });

        // Check for missing dates
        console.log('\n\n🔍 Verificando fechas sin sesiones...\n');
        const allDates = ['2026-03-20', '2026-03-21', '2026-03-22', '2026-03-23', '2026-03-24', '2026-03-25'];
        const datesWithSessions = Object.keys(byDate);
        const missingDates = allDates.filter(d => !datesWithSessions.includes(d));

        if (missingDates.length > 0) {
          console.log('⚠️  Sin sesiones en estas fechas:');
          missingDates.forEach(d => console.log(`   - ${d}`));
          console.log('\n❌ Conclusión: Las sesiones en estas fechas se perdieron.');
          console.log('\nPosibles causas:');
          console.log('1. Errores de API durante la creación');
          console.log('2. Las sesiones solo se guardaron en caché del navegador');
          console.log('3. Problemas de red impidieron el guardado');
          console.log('4. Bug en el código entre el 20 y 25 de marzo');
        } else {
          console.log('✅ Todas las fechas tienen sesiones.');
        }

        return;
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }

  console.log('\n⚠️  No se pudo conectar a la API de producción.');
  console.log('\n💡 Alternativa: Verifica manualmente en:');
  console.log('   Railway Dashboard > Deployments > URL de producción');
}

checkProductionAPI().catch(console.error);
