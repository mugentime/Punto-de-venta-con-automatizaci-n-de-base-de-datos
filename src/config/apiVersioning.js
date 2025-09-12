/**
 * API Versioning Configuration
 * Manages API versioning strategy and documentation
 */

/**
 * API Version Configuration
 */
const API_VERSIONS = {
  v1: {
    version: '1.0.0',
    status: 'stable',
    deprecated: false,
    sunset: null,
    changelog: [
      {
        version: '1.0.0',
        date: '2024-01-01',
        changes: [
          'Initial API release',
          'Authentication endpoints',
          'Product management',
          'Sales records',
          'Cash cuts functionality'
        ]
      }
    ]
  },
  v2: {
    version: '2.0.0',
    status: 'development',
    deprecated: false,
    sunset: null,
    changelog: [
      {
        version: '2.0.0-alpha',
        date: '2024-06-01',
        changes: [
          'Enhanced authentication with JWT refresh tokens',
          'Improved error handling with correlation IDs',
          'New analytics endpoints',
          'GraphQL support',
          'Real-time notifications'
        ]
      }
    ]
  }
};

/**
 * Version Detection Strategies
 */
const VERSION_STRATEGIES = {
  // URL Path versioning: /api/v1/users
  URL_PATH: 'url_path',
  
  // Header versioning: Accept: application/vnd.api+json;version=1
  HEADER: 'header',
  
  // Query parameter versioning: /api/users?version=1
  QUERY_PARAM: 'query_param',
  
  // Media type versioning: Accept: application/vnd.pos.v1+json
  MEDIA_TYPE: 'media_type'
};

/**
 * API Version Detection Middleware
 */
class ApiVersioning {
  constructor(strategy = VERSION_STRATEGIES.URL_PATH, defaultVersion = 'v1') {
    this.strategy = strategy;
    this.defaultVersion = defaultVersion;
    this.supportedVersions = Object.keys(API_VERSIONS);
  }

  /**
   * Version detection middleware
   */
  detectVersion() {
    return (req, res, next) => {
      let version = null;

      switch (this.strategy) {
        case VERSION_STRATEGIES.URL_PATH:
          version = this._detectFromUrlPath(req);
          break;
        
        case VERSION_STRATEGIES.HEADER:
          version = this._detectFromHeader(req);
          break;
        
        case VERSION_STRATEGIES.QUERY_PARAM:
          version = this._detectFromQueryParam(req);
          break;
        
        case VERSION_STRATEGIES.MEDIA_TYPE:
          version = this._detectFromMediaType(req);
          break;
        
        default:
          version = this.defaultVersion;
      }

      // Validate version
      if (!this.supportedVersions.includes(version)) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported API version',
          supportedVersions: this.supportedVersions,
          requestedVersion: version
        });
      }

      // Check if version is deprecated
      const versionInfo = API_VERSIONS[version];
      if (versionInfo.deprecated) {
        res.setHeader('Deprecation', 'true');
        if (versionInfo.sunset) {
          res.setHeader('Sunset', versionInfo.sunset);
        }
        res.setHeader('Link', `</api/docs/migration>; rel="successor-version"`);
      }

      // Attach version info to request
      req.apiVersion = {
        version,
        info: versionInfo,
        strategy: this.strategy
      };

      next();
    };
  }

  /**
   * Detect version from URL path
   * @private
   */
  _detectFromUrlPath(req) {
    const matches = req.path.match(/^\/api\/(v\d+)/);
    return matches ? matches[1] : this.defaultVersion;
  }

  /**
   * Detect version from custom header
   * @private
   */
  _detectFromHeader(req) {
    const versionHeader = req.headers['api-version'] || req.headers['x-api-version'];
    return versionHeader ? `v${versionHeader}` : this.defaultVersion;
  }

  /**
   * Detect version from query parameter
   * @private
   */
  _detectFromQueryParam(req) {
    const version = req.query.version || req.query.v;
    return version ? `v${version}` : this.defaultVersion;
  }

  /**
   * Detect version from Accept header media type
   * @private
   */
  _detectFromMediaType(req) {
    const acceptHeader = req.headers.accept || '';
    const matches = acceptHeader.match(/application\/vnd\.pos\.v(\d+)\+json/);
    return matches ? `v${matches[1]}` : this.defaultVersion;
  }

  /**
   * Get version information
   */
  getVersionInfo(version) {
    return API_VERSIONS[version] || null;
  }

  /**
   * Get all supported versions
   */
  getSupportedVersions() {
    return this.supportedVersions.map(version => ({
      version,
      ...API_VERSIONS[version]
    }));
  }

  /**
   * Version-aware routing
   */
  route(versionRoutes) {
    return (req, res, next) => {
      const version = req.apiVersion?.version || this.defaultVersion;
      const versionRouter = versionRoutes[version];

      if (!versionRouter) {
        return res.status(501).json({
          success: false,
          error: `Version ${version} is not implemented`,
          availableVersions: Object.keys(versionRoutes)
        });
      }

      // Mount the version-specific router
      versionRouter(req, res, next);
    };
  }
}

/**
 * Content Negotiation Middleware
 */
class ContentNegotiation {
  constructor() {
    this.supportedTypes = {
      json: 'application/json',
      xml: 'application/xml',
      csv: 'text/csv',
      pdf: 'application/pdf'
    };
  }

  negotiate() {
    return (req, res, next) => {
      const acceptHeader = req.headers.accept || 'application/json';
      
      // Simple content type detection
      let responseType = 'json';
      
      if (acceptHeader.includes('application/xml')) {
        responseType = 'xml';
      } else if (acceptHeader.includes('text/csv')) {
        responseType = 'csv';
      } else if (acceptHeader.includes('application/pdf')) {
        responseType = 'pdf';
      }

      req.responseType = responseType;
      res.setHeader('Content-Type', this.supportedTypes[responseType]);
      
      next();
    };
  }
}

/**
 * API Documentation Generator
 */
class ApiDocumentation {
  constructor() {
    this.docs = {};
  }

  /**
   * Register endpoint documentation
   */
  registerEndpoint(version, method, path, documentation) {
    if (!this.docs[version]) {
      this.docs[version] = {};
    }

    const key = `${method.toUpperCase()} ${path}`;
    this.docs[version][key] = {
      method: method.toUpperCase(),
      path,
      ...documentation,
      registeredAt: new Date().toISOString()
    };
  }

  /**
   * Generate OpenAPI specification
   */
  generateOpenApiSpec(version) {
    const versionInfo = API_VERSIONS[version];
    if (!versionInfo) {
      throw new Error(`Unknown API version: ${version}`);
    }

    const spec = {
      openapi: '3.0.0',
      info: {
        title: 'Conejo Negro POS API',
        version: versionInfo.version,
        description: 'Point of Sale system API for Conejo Negro Café',
        contact: {
          name: 'API Support',
          email: 'support@conejonegro.com'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: `/api/${version}`,
          description: `${versionInfo.status === 'stable' ? 'Production' : 'Development'} server`
        }
      ],
      paths: {},
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        },
        schemas: this._generateSchemas()
      },
      security: [{ bearerAuth: [] }]
    };

    // Add paths from registered documentation
    const versionDocs = this.docs[version] || {};
    for (const [endpoint, doc] of Object.entries(versionDocs)) {
      const [method, path] = endpoint.split(' ', 2);
      
      if (!spec.paths[path]) {
        spec.paths[path] = {};
      }
      
      spec.paths[path][method.toLowerCase()] = {
        summary: doc.summary,
        description: doc.description,
        parameters: doc.parameters || [],
        requestBody: doc.requestBody,
        responses: doc.responses || {
          200: { description: 'Success' },
          400: { description: 'Bad Request' },
          401: { description: 'Unauthorized' },
          500: { description: 'Internal Server Error' }
        },
        tags: doc.tags || []
      };
    }

    return spec;
  }

  /**
   * Generate common schemas
   * @private
   */
  _generateSchemas() {
    return {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'manager', 'employee'] },
          permissions: { type: 'object' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          category: { type: 'string', enum: ['cafetería', 'refrigerador', 'otros'] },
          quantity: { type: 'integer', minimum: 0 },
          cost: { type: 'number', minimum: 0 },
          price: { type: 'number', minimum: 0 },
          lowStockAlert: { type: 'integer', minimum: 1 },
          description: { type: 'string' },
          barcode: { type: 'string' },
          isActive: { type: 'boolean' },
          createdBy: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
          error: { type: 'string' },
          message: { type: 'string' },
          correlationId: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [false] },
          error: { type: 'string' },
          code: { type: 'string' },
          correlationId: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  /**
   * Get documentation for version
   */
  getDocumentation(version) {
    return this.docs[version] || {};
  }

  /**
   * Generate HTML documentation
   */
  generateHtmlDocs(version) {
    const spec = this.generateOpenApiSpec(version);
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${spec.info.title} - ${version}</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@3.25.0/swagger-ui.css" />
    <style>
        .swagger-ui .topbar { display: none; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@3.25.0/swagger-ui-bundle.js"></script>
    <script>
        SwaggerUIBundle({
            url: '/api/docs/${version}/openapi.json',
            dom_id: '#swagger-ui',
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIBundle.presets.standalone
            ],
            plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "StandaloneLayout",
            deepLinking: true,
            showExtensions: true,
            showCommonExtensions: true
        });
    </script>
</body>
</html>
    `;
  }
}

module.exports = {
  API_VERSIONS,
  VERSION_STRATEGIES,
  ApiVersioning,
  ContentNegotiation,
  ApiDocumentation
};