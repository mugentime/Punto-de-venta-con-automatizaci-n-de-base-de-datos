const express = require('express');
const { ApiDocumentation, API_VERSIONS } = require('../config/apiVersioning');

/**
 * API Documentation Routes
 * Serves OpenAPI specs and Swagger UI
 */
function createDocsRoutes(apiDocumentation) {
  const router = express.Router();

  // API Documentation index
  router.get('/', (req, res) => {
    const versions = Object.keys(API_VERSIONS).map(version => ({
      version,
      ...API_VERSIONS[version],
      links: {
        docs: `/api/docs/${version}`,
        openapi: `/api/docs/${version}/openapi.json`,
        changelog: `/api/docs/${version}/changelog`
      }
    }));

    res.json({
      title: 'Conejo Negro POS API Documentation',
      description: 'Point of Sale system API documentation',
      versions,
      links: {
        migration: '/api/docs/migration',
        status: '/api/docs/status'
      }
    });
  });

  // API Status and health
  router.get('/status', (req, res) => {
    const status = Object.entries(API_VERSIONS).map(([version, info]) => ({
      version,
      status: info.status,
      deprecated: info.deprecated,
      sunset: info.sunset
    }));

    res.json({
      status: 'operational',
      versions: status,
      timestamp: new Date().toISOString()
    });
  });

  // Migration guide
  router.get('/migration', (req, res) => {
    res.json({
      title: 'API Migration Guide',
      description: 'Guide for migrating between API versions',
      migrations: [
        {
          from: 'v1',
          to: 'v2',
          breakingChanges: [
            'Authentication now requires JWT tokens',
            'Error response format has changed',
            'Date fields now return ISO 8601 format'
          ],
          migrationSteps: [
            '1. Update authentication to use JWT tokens',
            '2. Update error handling for new format',
            '3. Update date parsing logic',
            '4. Test all endpoints thoroughly'
          ],
          deadline: '2024-12-31',
          supportContact: 'support@conejonegro.com'
        }
      ]
    });
  });

  // Version-specific documentation
  router.get('/:version', (req, res) => {
    const { version } = req.params;
    
    if (!API_VERSIONS[version]) {
      return res.status(404).json({
        success: false,
        error: 'API version not found',
        availableVersions: Object.keys(API_VERSIONS)
      });
    }

    // Serve Swagger UI HTML
    const html = apiDocumentation.generateHtmlDocs(version);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  // OpenAPI JSON spec
  router.get('/:version/openapi.json', (req, res) => {
    const { version } = req.params;
    
    if (!API_VERSIONS[version]) {
      return res.status(404).json({
        success: false,
        error: 'API version not found'
      });
    }

    try {
      const spec = apiDocumentation.generateOpenApiSpec(version);
      res.json(spec);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate OpenAPI specification',
        message: error.message
      });
    }
  });

  // Changelog for specific version
  router.get('/:version/changelog', (req, res) => {
    const { version } = req.params;
    
    if (!API_VERSIONS[version]) {
      return res.status(404).json({
        success: false,
        error: 'API version not found'
      });
    }

    res.json({
      version,
      changelog: API_VERSIONS[version].changelog,
      status: API_VERSIONS[version].status,
      deprecated: API_VERSIONS[version].deprecated,
      sunset: API_VERSIONS[version].sunset
    });
  });

  // Raw documentation data
  router.get('/:version/raw', (req, res) => {
    const { version } = req.params;
    
    if (!API_VERSIONS[version]) {
      return res.status(404).json({
        success: false,
        error: 'API version not found'
      });
    }

    const docs = apiDocumentation.getDocumentation(version);
    res.json({
      version,
      endpoints: docs,
      versionInfo: API_VERSIONS[version]
    });
  });

  // Postman collection export
  router.get('/:version/postman', (req, res) => {
    const { version } = req.params;
    
    if (!API_VERSIONS[version]) {
      return res.status(404).json({
        success: false,
        error: 'API version not found'
      });
    }

    try {
      const spec = apiDocumentation.generateOpenApiSpec(version);
      const postmanCollection = convertToPostman(spec, version);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="conejo-negro-api-${version}.postman_collection.json"`);
      res.json(postmanCollection);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate Postman collection',
        message: error.message
      });
    }
  });

  return router;
}

/**
 * Convert OpenAPI spec to Postman collection format
 * @private
 */
function convertToPostman(spec, version) {
  const collection = {
    info: {
      name: `${spec.info.title} - ${version}`,
      description: spec.info.description,
      version: spec.info.version,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    auth: {
      type: 'bearer',
      bearer: [
        {
          key: 'token',
          value: '{{authToken}}',
          type: 'string'
        }
      ]
    },
    variable: [
      {
        key: 'baseUrl',
        value: `{{protocol}}://{{host}}${spec.servers[0].url}`,
        type: 'string'
      },
      {
        key: 'authToken',
        value: '',
        type: 'string'
      }
    ],
    item: []
  };

  // Convert paths to Postman items
  for (const [path, methods] of Object.entries(spec.paths)) {
    const folder = {
      name: path,
      item: []
    };

    for (const [method, operation] of Object.entries(methods)) {
      const item = {
        name: operation.summary || `${method.toUpperCase()} ${path}`,
        request: {
          method: method.toUpperCase(),
          header: [
            {
              key: 'Content-Type',
              value: 'application/json',
              type: 'text'
            }
          ],
          url: {
            raw: `{{baseUrl}}${path}`,
            host: ['{{baseUrl}}'],
            path: path.split('/').filter(p => p)
          },
          description: operation.description
        },
        response: []
      };

      // Add request body if present
      if (operation.requestBody) {
        item.request.body = {
          mode: 'raw',
          raw: JSON.stringify(generateExampleFromSchema(operation.requestBody), null, 2),
          options: {
            raw: {
              language: 'json'
            }
          }
        };
      }

      // Add query parameters
      if (operation.parameters) {
        const queryParams = operation.parameters
          .filter(param => param.in === 'query')
          .map(param => ({
            key: param.name,
            value: param.example || '',
            description: param.description,
            disabled: !param.required
          }));

        if (queryParams.length > 0) {
          item.request.url.query = queryParams;
        }
      }

      folder.item.push(item);
    }

    collection.item.push(folder);
  }

  return collection;
}

/**
 * Generate example data from schema
 * @private
 */
function generateExampleFromSchema(schema) {
  // Simplified example generation
  // In a real implementation, you'd recursively generate examples
  return {
    example: 'Generated from schema'
  };
}

module.exports = createDocsRoutes;