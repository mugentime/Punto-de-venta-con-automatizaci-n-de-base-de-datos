// Test script to check coworking sessions API
const https = require('https');
const http = require('http');

async function testAPI(url, description) {
  console.log(`\n🔍 Testing: ${description}`);
  console.log(`   URL: ${url}`);

  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;

    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        try {
          const parsed = JSON.parse(data);
          console.log(`   Response: ${JSON.stringify(parsed).substring(0, 200)}${JSON.stringify(parsed).length > 200 ? '...' : ''}`);
          resolve({ status: res.statusCode, data: parsed });
        } catch (err) {
          console.log(`   Response (raw): ${data.substring(0, 200)}${data.length > 200 ? '...' : ''}`);
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => {
      console.log(`   ❌ Error: ${err.message}`);
      resolve({ status: 0, error: err.message });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      console.log(`   ⏱️ Timeout after 5 seconds`);
      resolve({ status: 0, error: 'Timeout' });
    });
  });
}

async function main() {
  console.log('🧪 Coworking Sessions API Test\n');
  console.log('Testing local development server...\n');

  // Test local server
  await testAPI('http://localhost:5173/api/health', 'Health Check');
  await testAPI('http://localhost:5173/api/coworking-sessions', 'Get Coworking Sessions (Local)');

  console.log('\n' + '='.repeat(60));
  console.log('Testing Railway production server...\n');

  // Test Railway server
  const railwayUrl = 'https://pos-conejo-negro.onrender.com';
  await testAPI(`${railwayUrl}/api/health`, 'Health Check (Production)');
  await testAPI(`${railwayUrl}/api/coworking-sessions`, 'Get Coworking Sessions (Production)');

  console.log('\n✅ Test complete');
}

main().catch(console.error);
