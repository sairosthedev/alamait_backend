// Webdev Hosting Configuration
// This file contains Webdev-specific settings for the Alamait backend

module.exports = {
  // Server configuration
  port: process.env.PORT || 3000,
  host: '0.0.0.0',
  
  // SSL configuration (Webdev provides SSL certificates)
  ssl: {
    enabled: true,
    redirectHttp: true
  },
  
  // CORS configuration for production
  cors: {
    origin: [
      'https://alamait.com',
      'https://www.alamait.com',
      'https://api.alamait.com'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With',
      'Accept',
      'Origin'
    ]
  },
  
  // File upload configuration
  uploads: {
    maxFileSize: '10mb',
    allowedTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  },
  
  // Database configuration
  database: {
    connectionTimeout: 30000,
    socketTimeout: 45000,
    maxPoolSize: 10,
    minPoolSize: 5
  },
  
  // Logging configuration
  logging: {
    level: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
    file: '/var/log/alamait-backend.log'
  },
  
  // Security configuration
  security: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://alamait.com"]
        }
      }
    }
  },
  
  // Email configuration
  email: {
    retryAttempts: 3,
    retryDelay: 5000
  },
  
  // AWS S3 configuration
  s3: {
    region: process.env.AWS_REGION || 'us-east-1',
    bucket: process.env.S3_BUCKET_NAME || 'alamait-uploads',
    acl: 'private',
    expires: 3600 // 1 hour for presigned URLs
  }
}; 