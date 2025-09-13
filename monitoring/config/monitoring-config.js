/**
 * Comprehensive Monitoring Configuration for POS Railway Deployment
 * @description Central configuration for health checks, performance monitoring, and alerting
 * @author Operational Launch Monitor
 * @version 1.0.0
 */

module.exports = {
  // Railway deployment configuration
  deployment: {
    name: 'POS Conejo Negro',
    environment: process.env.RAILWAY_ENVIRONMENT || 'production',
    url: process.env.RAILWAY_PUBLIC_DOMAIN || 'https://pos-conejonegro-production.up.railway.app',
    version: process.env.RAILWAY_GIT_COMMIT || 'unknown',
    serviceId: process.env.RAILWAY_SERVICE_ID || 'local'
  },

  // Health check endpoints configuration
  healthChecks: {
    interval: 30000, // 30 seconds
    timeout: 10000,  // 10 seconds
    retries: 3,
    endpoints: [
      {
        name: 'Main Application',
        url: '/api/health',
        critical: true,
        expectedStatus: 200,
        expectedFields: ['status', 'isDatabaseReady', 'uptime']
      },
      {
        name: 'Version Info',
        url: '/api/version',
        critical: false,
        expectedStatus: 200,
        expectedFields: ['version', 'environment']
      },
      {
        name: 'Database Connection',
        url: '/api/debug/users',
        critical: true,
        expectedStatus: 200,
        expectedFields: ['userCount']
      },
      {
        name: 'Authentication System',
        url: '/api/auth/status',
        critical: true,
        expectedStatus: 200
      },
      {
        name: 'POS Frontend',
        url: '/',
        critical: true,
        expectedStatus: 200
      },
      {
        name: 'Online POS Version',
        url: '/online',
        critical: false,
        expectedStatus: 200
      }
    ]
  },

  // Performance thresholds
  performance: {
    responseTime: {
      excellent: 200,  // < 200ms
      good: 500,       // 200-500ms
      poor: 1000,      // 500ms-1s
      critical: 2000   // > 2s
    },
    errorRate: {
      warning: 0.01,   // 1%
      critical: 0.05   // 5%
    },
    memoryUsage: {
      warning: 0.80,   // 80%
      critical: 0.95   // 95%
    },
    diskUsage: {
      warning: 0.85,   // 85%
      critical: 0.95   // 95%
    }
  },

  // Alert configuration
  alerts: {
    channels: {
      console: {
        enabled: true,
        level: 'info'
      },
      email: {
        enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
        recipients: (process.env.ALERT_EMAIL_RECIPIENTS || '').split(',').filter(Boolean),
        smtp: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        }
      },
      webhook: {
        enabled: process.env.ALERT_WEBHOOK_ENABLED === 'true',
        urls: (process.env.ALERT_WEBHOOK_URLS || '').split(',').filter(Boolean)
      },
      slack: {
        enabled: process.env.SLACK_WEBHOOK_URL ? true : false,
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_CHANNEL || '#alerts'
      }
    },
    rules: [
      {
        name: 'Application Down',
        condition: 'health_check_failed',
        severity: 'critical',
        description: 'Main application health check failed',
        cooldown: 300000 // 5 minutes
      },
      {
        name: 'High Response Time',
        condition: 'response_time_high',
        severity: 'warning',
        threshold: 2000,
        description: 'Response time exceeds 2 seconds',
        cooldown: 600000 // 10 minutes
      },
      {
        name: 'Database Connection Lost',
        condition: 'database_unavailable',
        severity: 'critical',
        description: 'Database connection failed',
        cooldown: 180000 // 3 minutes
      },
      {
        name: 'High Error Rate',
        condition: 'error_rate_high',
        severity: 'warning',
        threshold: 0.05,
        description: 'Error rate exceeds 5%',
        cooldown: 900000 // 15 minutes
      },
      {
        name: 'Memory Usage High',
        condition: 'memory_usage_high',
        severity: 'warning',
        threshold: 0.90,
        description: 'Memory usage exceeds 90%',
        cooldown: 1200000 // 20 minutes
      },
      {
        name: 'Authentication Failure',
        condition: 'auth_system_down',
        severity: 'critical',
        description: 'Authentication system unavailable',
        cooldown: 300000 // 5 minutes
      }
    ]
  },

  // Metrics collection configuration
  metrics: {
    collection: {
      interval: 60000, // 1 minute
      retention: {
        raw: 86400000,    // 24 hours
        hourly: 2592000000, // 30 days
        daily: 31536000000  // 1 year
      }
    },
    system: [
      'cpu_usage',
      'memory_usage',
      'disk_usage',
      'network_io'
    ],
    application: [
      'response_time',
      'request_rate',
      'error_rate',
      'active_connections',
      'database_queries',
      'authentication_attempts'
    ],
    business: [
      'daily_sales',
      'active_users',
      'product_updates',
      'cash_cuts_completed',
      'backup_status'
    ]
  },

  // Dashboard configuration
  dashboards: {
    operational: {
      refreshInterval: 30000, // 30 seconds
      widgets: [
        'system_status',
        'response_time_chart',
        'error_rate_chart',
        'active_users',
        'database_status',
        'recent_alerts'
      ]
    },
    business: {
      refreshInterval: 300000, // 5 minutes
      widgets: [
        'daily_sales_chart',
        'user_activity',
        'inventory_status',
        'cash_flow',
        'backup_history'
      ]
    }
  },

  // Notification templates
  templates: {
    email: {
      subject: '[{{severity}}] {{alertName}} - POS Conejo Negro',
      html: `
        <h2 style="color: {{#if critical}}#dc3545{{else}}#ffc107{{/if}};">
          🚨 Alert: {{alertName}}
        </h2>
        <p><strong>Service:</strong> POS Conejo Negro</p>
        <p><strong>Environment:</strong> {{environment}}</p>
        <p><strong>Severity:</strong> {{severity}}</p>
        <p><strong>Time:</strong> {{timestamp}}</p>
        <p><strong>Description:</strong> {{description}}</p>
        {{#if details}}
        <pre style="background: #f8f9fa; padding: 10px; border-radius: 4px;">{{details}}</pre>
        {{/if}}
        <p><a href="{{dashboardUrl}}" style="background: #007bff; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">View Dashboard</a></p>
      `
    },
    slack: {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ':warning: *{{alertName}}* - {{severity}}'
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: '*Service:*\nPOS Conejo Negro' },
            { type: 'mrkdwn', text: '*Environment:*\n{{environment}}' },
            { type: 'mrkdwn', text: '*Time:*\n{{timestamp}}' },
            { type: 'mrkdwn', text: '*Description:*\n{{description}}' }
          ]
        }
      ]
    }
  },

  // Security monitoring
  security: {
    authFailureThreshold: 5,    // Max failed login attempts per minute
    suspiciousActivityThreshold: 10, // Max suspicious requests per minute
    rateLimitViolations: 20,    // Max rate limit violations per hour
    monitoring: [
      'failed_logins',
      'suspicious_requests',
      'rate_limit_violations',
      'unauthorized_access_attempts',
      'admin_actions'
    ]
  },

  // Railway-specific monitoring
  railway: {
    monitoring: [
      'deployment_status',
      'build_duration',
      'restart_count',
      'resource_usage',
      'postgres_connection_status'
    ],
    webhooks: {
      deployment: process.env.RAILWAY_WEBHOOK_URL,
      alerts: process.env.RAILWAY_ALERT_WEBHOOK
    }
  }
};