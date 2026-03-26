// Get DATABASE_URL from Railway API
const https = require('https');
require('dotenv').config();

async function getDatabaseUrl() {
  const apiToken = process.env.RAILWAY_API_TOKEN;
  const projectId = process.env.RAILWAY_PROJECT_ID;

  if (!apiToken || !projectId) {
    console.error('❌ Missing RAILWAY_API_TOKEN or RAILWAY_PROJECT_ID in .env');
    process.exit(1);
  }

  console.log('🔍 Fetching DATABASE_URL from Railway...\n');

  const query = `
    query project($id: String!) {
      project(id: $id) {
        services {
          edges {
            node {
              id
              name
              variables {
                edges {
                  node {
                    name
                    value
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = JSON.stringify({
    query,
    variables: { id: projectId }
  });

  const options = {
    hostname: 'backboard.railway.app',
    path: '/graphql/v2',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);

          if (response.errors) {
            console.error('❌ GraphQL Error:', JSON.stringify(response.errors, null, 2));
            reject(new Error('GraphQL query failed'));
            return;
          }

          // Find PostgreSQL service
          const services = response.data?.project?.services?.edges || [];

          for (const { node: service } of services) {
            const variables = service.variables?.edges || [];
            const dbUrl = variables.find(({ node: v }) => v.name === 'DATABASE_URL');

            if (dbUrl) {
              console.log('✅ Found DATABASE_URL from service:', service.name);
              console.log('\n📝 Copy this value to your .env file:\n');
              console.log(`DATABASE_URL=${dbUrl.node.value}`);
              console.log('\n');
              resolve(dbUrl.node.value);
              return;
            }
          }

          console.error('❌ Could not find DATABASE_URL in any service');
          reject(new Error('DATABASE_URL not found'));
        } catch (error) {
          console.error('❌ Parse Error:', error.message);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request Error:', error.message);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

getDatabaseUrl().catch(console.error);
