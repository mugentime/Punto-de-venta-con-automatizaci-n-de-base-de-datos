// Use Railway API to get current DATABASE_URL
const https = require('https');

const RAILWAY_API_TOKEN = process.env.RAILWAY_API_TOKEN || 'e0ae87e0-75e3-4db6-bebe-8286df2b7a10';
const RAILWAY_PROJECT_ID = process.env.RAILWAY_PROJECT_ID || 'fed11c6d-a65a-4d93-90e6-955e16b6753f';

async function getRailwayVariables() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      query: `
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
      `,
      variables: {
        id: RAILWAY_PROJECT_ID
      }
    });

    const options = {
      hostname: 'backboard.railway.app',
      path: '/graphql/v2',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.errors) {
            reject(new Error(JSON.stringify(result.errors)));
          } else {
            resolve(result);
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

getRailwayVariables()
  .then(result => {
    console.log('Railway Project Variables:');
    const services = result.data?.project?.services?.edges || [];
    services.forEach(service => {
      console.log(`\n🚂 Service: ${service.node.name}`);
      const variables = service.node.variables?.edges || [];
      variables.forEach(variable => {
        if (variable.node.name === 'DATABASE_URL' || variable.node.name.includes('DATABASE')) {
          console.log(`  ${variable.node.name}: ${variable.node.value}`);
        }
      });
    });
  })
  .catch(error => {
    console.error('❌ Error:', error.message);
  });
