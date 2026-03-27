// Quick test for coworking sessions API
const http = require('http');

http.get('http://localhost:3001/api/coworking-sessions', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const sessions = JSON.parse(data);
    console.log(`\n✅ Found ${sessions.length} sessions\n`);

    if (sessions.length > 0) {
      const firstSession = sessions[0];
      console.log('First session fields:');
      console.log(`  id: ${firstSession.id || 'MISSING'}`);
      console.log(`  _id: ${firstSession._id || 'MISSING'}`);
      console.log(`  clientName: ${firstSession.clientName || 'MISSING ❌'}`);
      console.log(`  client: ${firstSession.client || 'MISSING'}`);
      console.log(`  status: ${firstSession.status}`);
      console.log(`  startTime: ${firstSession.startTime}`);
      console.log(`  endTime: ${firstSession.endTime}`);
      console.log('\nAll sessions:');
      sessions.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.clientName || s.client} (${s.status})`);
      });
    }
  });
}).on('error', err => {
  console.error('❌ Error:', err.message);
});
