# Alamait Property Management System Backend

## System Monitoring and Backup

### Performance Monitoring

The system includes comprehensive performance monitoring to ensure compliance with SRS requirements:

#### Monitoring Endpoints

1. System Health Check
   ```
   GET /api/monitoring/health
   ```
   - Returns detailed system health information
   - Includes memory usage, uptime, and environment details
   - No authentication required
   - Response includes heap usage and system metrics

2. Performance Metrics (Admin Only)
   ```
   GET /api/monitoring/performance
   ```
   - Requires admin authentication
   - Tracks dashboard load times (2-second SLA requirement)
   - Reports total requests and slow requests
   - Indicates SLA compliance status

3. Prometheus Metrics (Admin Only)
   ```
   GET /api/monitoring/metrics
   ```
   - Exposes Prometheus-formatted metrics
   - Includes custom HTTP request duration metrics
   - Tracks request counts and response times
   - Compatible with Prometheus monitoring system

### Automated Backup System

The system includes automated daily backups with management capabilities:

#### Backup Management Endpoints (Admin Only)

1. Create Backup
   ```
   POST /api/admin/backup/create
   ```
   - Triggers immediate database backup
   - Returns backup file path
   - Automatically compresses backup

2. List Backups
   ```
   GET /api/admin/backup/list
   ```
   - Lists all available backups
   - Includes file size and creation date
   - Sorted by creation date (newest first)

3. Restore Backup
   ```
   POST /api/admin/backup/restore/{filename}
   ```
   - Restores database from specified backup
   - Requires backup filename in path
   - Use with caution - overwrites current data

4. Delete Backup
   ```
   DELETE /api/admin/backup/{filename}
   ```
   - Deletes specified backup file
   - Requires backup filename in path

### Automatic Features

1. Daily Backups
   - Runs automatically every 24 hours
   - Maintains 7-day retention period
   - Compresses backups to save space
   - Logs backup operations

2. Performance Monitoring
   - Tracks all API endpoints
   - Alerts on slow responses (>2 seconds)
   - Monitors memory usage
   - Records request metrics

### Setup Requirements

1. MongoDB Tools
   ```bash
   npm install -g mongodb-tools
   ```

2. Prometheus Setup (Optional)
   ```yaml
   # docker-compose.yml
   version: '3'
   services:
     prometheus:
       image: prom/prometheus
       ports:
         - "9090:9090"
       volumes:
         - ./prometheus.yml:/etc/prometheus/prometheus.yml
   ```

3. Environment Variables
   ```env
   MONGODB_URI=your_mongodb_uri
   NODE_ENV=development
   ```

### Security Notes

- All backup and monitoring management endpoints require admin authentication
- Backup files are stored securely in the `backups` directory
- Sensitive metrics are only accessible to admin users
- Health check endpoint is public for monitoring services
