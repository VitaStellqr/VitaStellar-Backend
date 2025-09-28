# GDPR Compliance Implementation

This document describes the GDPR (General Data Protection Regulation) compliance features implemented in the Uzima Backend application.

## Overview

The implementation provides comprehensive GDPR compliance features including:
- User data export functionality
- User data deletion with retention policies
- Admin dashboard for managing GDPR requests
- Comprehensive audit logging
- Background job processing

## Features

### 1. Data Export (`GET /api/users/:id/export-data`)

Allows users to export all their personal data in JSON or CSV format.

**Features:**
- Export in JSON or CSV format
- Includes all user-related data (profile, records, logs, GDPR requests)
- Background processing for large datasets
- Secure download links with expiration
- Comprehensive audit logging

**Usage:**
```bash
GET /api/users/{userId}/export-data?format=json
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Data export request submitted successfully",
  "data": {
    "requestId": "64f8a1b2c3d4e5f6a7b8c9d0",
    "status": "processing",
    "estimatedCompletion": "5-10 minutes"
  }
}
```

### 2. Data Deletion (`DELETE /api/users/:id/erase`)

Implements the "right to be forgotten" with proper retention policies.

**Features:**
- Immediate soft-deletion of user account
- Scheduled permanent deletion after 30 days
- Prevents duplicate deletion requests
- Comprehensive audit trail
- Background job processing

**Usage:**
```bash
DELETE /api/users/{userId}/erase
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "User requested data deletion"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Data deletion request submitted successfully",
  "data": {
    "requestId": "64f8a1b2c3d4e5f6a7b8c9d0",
    "status": "processing",
    "message": "Data deletion request submitted. User will be soft-deleted immediately and permanently deleted after 30 days."
  }
}
```

### 3. Status Checking

Users can check the status of their export or deletion requests.

**Export Status:**
```bash
GET /api/users/{userId}/export-status/{requestId}
Authorization: Bearer {token}
```

**Deletion Status:**
```bash
GET /api/users/{userId}/deletion-status/{requestId}
Authorization: Bearer {token}
```

### 4. Admin Dashboard

Administrators can view and manage all GDPR requests.

**List All Requests:**
```bash
GET /api/admin/gdpr-requests?page=1&limit=20&status=completed&requestType=export
Authorization: Bearer {adminToken}
```

**Get Request Details:**
```bash
GET /api/admin/gdpr-requests/{requestId}
Authorization: Bearer {adminToken}
```

## Data Models

### GDPRRequest Model

```javascript
{
  userId: ObjectId,           // User whose data is being processed
  requestType: String,        // 'export' or 'delete'
  status: String,            // 'pending', 'processing', 'completed', 'failed'
  requestedBy: ObjectId,     // User who made the request
  exportFormat: String,      // 'json' or 'csv' (for export requests)
  exportData: Mixed,         // Exported data (for completed exports)
  downloadUrl: String,       // Secure download link
  deletionScheduledAt: Date,  // When permanent deletion is scheduled
  deletionCompletedAt: Date, // When permanent deletion was completed
  requestReason: String,     // Reason for the request
  ipAddress: String,         // IP address of requester
  userAgent: String,         // User agent of requester
  processingStartedAt: Date, // When processing began
  processingCompletedAt: Date, // When processing completed
  errorMessage: String,      // Error message if failed
  expiresAt: Date            // When the request expires (30 days)
}
```

## Security Features

### 1. Access Control
- Users can only export/delete their own data
- Admins can access any user's data
- Role-based permissions using RBAC system
- JWT token authentication required

### 2. Audit Logging
- All GDPR operations are logged in `transactionLog` collection
- Includes IP address, user agent, and timestamp
- Tracks who performed what action when

### 3. Data Retention
- Export files expire after 30 days
- GDPR requests are automatically cleaned up
- Permanent deletion follows 30-day retention policy

## Background Jobs

### 1. Data Export Job
- Processes export requests asynchronously
- Assembles all user-related data
- Creates downloadable files
- Updates request status

### 2. Data Deletion Job
- Performs immediate soft-deletion
- Schedules permanent deletion
- Handles cleanup of related data

### 3. Permanent Deletion Job
- Runs daily at 2 AM UTC
- Permanently deletes data after retention period
- Comprehensive cleanup of all related records

## File Structure

```
src/
├── models/
│   └── GDPRRequest.js          # GDPR request model
├── controllers/
│   └── gdprController.js        # GDPR endpoint handlers
├── jobs/
│   └── gdprJobs.js             # Background job processing
├── routes/
│   ├── gdprRoutes.js            # User GDPR routes
│   └── adminGDPRRoutes.js       # Admin GDPR routes
├── __tests__/
│   └── gdpr.test.js             # Comprehensive test suite
└── exports/                      # Export files directory
```

## Testing

The implementation includes comprehensive tests covering:
- All endpoint functionality
- Permission checks
- Error handling
- Data export content
- Audit logging
- Background job processing

Run tests with:
```bash
npm test -- --testPathPattern=gdpr.test.js
```

## Configuration

### Environment Variables
- `JWT_SECRET`: Required for token validation
- `MONGODB_URI`: Database connection string

### Role Permissions
The following permissions are required:
- `gdpr_export`: Export user data
- `gdpr_delete`: Delete user data  
- `gdpr_manage`: Admin access to GDPR requests

## Compliance Features

### 1. Data Portability
- Users can export all their data in standard formats
- Includes complete data history and metadata
- Machine-readable JSON and human-readable CSV formats

### 2. Right to Erasure
- Immediate account deactivation
- Scheduled permanent deletion
- Comprehensive data cleanup
- Audit trail preservation

### 3. Transparency
- Clear status reporting
- Detailed request tracking
- Admin oversight capabilities
- Comprehensive logging

### 4. Data Minimization
- Only exports requested data
- Automatic cleanup of expired requests
- Retention policy enforcement

## Monitoring and Alerts

The system provides comprehensive monitoring through:
- Request status tracking
- Processing time metrics
- Error logging and alerting
- Admin dashboard for oversight

## Future Enhancements

Potential improvements include:
- Email notifications for request completion
- Bulk export/delete operations
- Data anonymization options
- Enhanced reporting and analytics
- Integration with external compliance tools
