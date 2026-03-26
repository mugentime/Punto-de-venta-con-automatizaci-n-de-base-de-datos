const https = require('https');

const RAILWAY_TOKEN = 'c3ef8d7a-e6cc-4fbd-abc0-7ac2ec7f2c42'; // Project token
const PROJECT_ID = 'fed11c6d-a65a-4d93-90e6-955e16b6753f';

// GraphQL query to get environment variables
const query = `
  query project($id: String!) {
    project(id: $id) {
      id
      name
      environments {
        edges {
          node {
            id
            name
            serviceInstances {
              edges {
                node {
                  serviceId
                  latestDeployment {
                    staticUrl
                  }
                }
              }
            }
          }
        }
      }
      plugins {
        edges {
          node {
            id
            name
            variables {
              edges {
                node {
                  name
                  pluginId
                  environmentId
                  serviceId
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
  query: query,
  variables: {
    id: PROJECT_ID
  }
});

const options = {
  hostname: 'backboard.railway.app',
  port: 443,
  path: '/graphql/v2',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Authorization': `Bearer ${RAILWAY_TOKEN}`
  }
};

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(responseData);

      if (result.errors) {
        console.error('❌ GraphQL errors:', JSON.stringify(result.errors, null, 2));
        return;
      }

      if (!result.data || !result.data.project) {
        console.error('❌ No project data returned');
        console.log('Response:', JSON.stringify(result, null, 2));
        return;
      }

      console.log('✅ Project:', result.data.project.name);
      console.log('\n📊 Plugins:\n');

      if (result.data.project.plugins && result.data.project.plugins.edges) {
        console.log(`Found ${result.data.project.plugins.edges.length} plugins`);

        result.data.project.plugins.edges.forEach(pluginEdge => {
          const plugin = pluginEdge.node;
          console.log(`\n🔹 Plugin: ${plugin.name} (ID: ${plugin.id})`);

          if (plugin.variables && plugin.variables.edges) {
            console.log(`   Variables: ${plugin.variables.edges.length}`);
            plugin.variables.edges.forEach(varEdge => {
              const variable = varEdge.node;
              console.log(`   - ${variable.name}`);
            });
          }
        });

        console.log('\n\nFull response:', JSON.stringify(result.data, null, 2));
      } else {
        console.log('No plugins found');
        console.log('Full response:', JSON.stringify(result.data, null, 2));
      }

    } catch (error) {
      console.error('❌ Error parsing response:', error.message);
      console.log('Raw response:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

req.write(data);
req.end();
