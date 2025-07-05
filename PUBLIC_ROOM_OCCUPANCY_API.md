# Public Room Occupancy API Documentation

## Overview
The Public Room Occupancy API provides real-time access to room availability, application status, and residence information without requiring authentication. This allows public users to view current room occupancy status across all residences.

## Base URL
```
http://localhost:5000/api/public/applications
```

## Endpoints

### 1. Get Public Application Data with Room Occupancy Status
**GET** `/public-data`

Returns comprehensive data including room occupancy status, application statistics, and residence information.

#### Query Parameters
- `residence` (optional): Filter by residence name (case-insensitive)
- `status` (optional): Filter applications by status (`pending`, `approved`, `waitlisted`, `rejected`)
- `type` (optional): Filter applications by type (`boarding`, `new`, etc.)

#### Example Requests
```bash
# Get all data
GET /api/public/applications/public-data

# Filter by residence
GET /api/public/applications/public-data?residence=Belvedere

# Filter by application status
GET /api/public/applications/public-data?status=approved

# Filter by application type
GET /api/public/applications/public-data?type=boarding

# Combined filters
GET /api/public/applications/public-data?residence=St%20Kilda&status=approved
```

#### Response Structure
```json
{
  "success": true,
  "timestamp": "2025-07-05T12:51:24.197Z",
  "statistics": {
    "rooms": {
      "total": 33,
      "available": 25,
      "occupied": 1,
      "reserved": 7,
      "maintenance": 0,
      "overallOccupancyRate": 24.2
    },
    "applications": {
      "total": 5,
      "pending": 1,
      "approved": 4,
      "waitlisted": 0,
      "rejected": 0
    }
  },
  "residences": [
    {
      "id": "67c13eb8425a2e078f61d00e",
      "name": "Belvedere Student House",
      "address": {
        "street": "12 Belvedere Road",
        "city": "Belvedere",
        "state": "Harare",
        "country": "Zimbabwe"
      },
      "totalRooms": 4,
      "availableRooms": 3,
      "occupiedRooms": 0,
      "reservedRooms": 1,
      "maintenanceRooms": 0,
      "occupancyRate": 25.0
    }
  ],
  "rooms": [
    {
      "id": "Belvedere Student House-A1",
      "residenceId": "67c13eb8425a2e078f61d00e",
      "residenceName": "Belvedere Student House",
      "residenceAddress": {
        "street": "12 Belvedere Road",
        "city": "Belvedere",
        "state": "Harare",
        "country": "Zimbabwe"
      },
      "roomNumber": "A1",
      "type": "single",
      "capacity": 1,
      "currentOccupancy": 0,
      "price": 180,
      "status": "available",
      "features": [
        "Private bathroom",
        "Study desk",
        "Built-in wardrobe"
      ],
      "floor": 1,
      "area": 20,
      "occupancyRate": 0,
      "isAvailable": true,
      "isOccupied": false,
      "isReserved": false,
      "isMaintenance": false
    }
  ],
  "applications": [
    {
      "applicationCode": "APP256511",
      "status": "approved",
      "requestType": "new",
      "preferredRoom": "A1",
      "allocatedRoom": "A1",
      "waitlistedRoom": null,
      "applicationDate": "2025-01-01T00:00:00.000Z",
      "residence": {
        "id": "67c13eb8425a2e078f61d00e",
        "name": "Belvedere Student House",
        "address": {
          "street": "12 Belvedere Road",
          "city": "Belvedere",
          "state": "Harare",
          "country": "Zimbabwe"
        }
      }
    }
  ]
}
```

## Key Features

### 1. Real-Time Room Status
- **Available**: Rooms ready for occupancy
- **Occupied**: Currently occupied rooms
- **Reserved**: Rooms reserved for future occupancy
- **Maintenance**: Rooms under maintenance

### 2. Detailed Room Information
- Room number and type
- Capacity and current occupancy
- Pricing information
- Room features and amenities
- Floor and area details
- Individual room occupancy rates

### 3. Residence Statistics
- Total rooms per residence
- Available/occupied/reserved/maintenance counts
- Residence-specific occupancy rates
- Complete address information

### 4. Application Tracking
- Application status (pending, approved, waitlisted, rejected)
- Request types (new, boarding, etc.)
- Room allocation information
- Application dates

### 5. Filtering Capabilities
- Filter by residence name
- Filter by application status
- Filter by application type
- Combined filtering options

## Usage Examples

### Frontend Integration
```javascript
// Fetch all room occupancy data
const response = await fetch('/api/public/applications/public-data');
const data = await response.json();

// Display overall statistics
console.log(`Overall Occupancy: ${data.statistics.rooms.overallOccupancyRate}%`);
console.log(`Available Rooms: ${data.statistics.rooms.available}`);

// Display residence-specific data
data.residences.forEach(residence => {
  console.log(`${residence.name}: ${residence.occupancyRate}% occupied`);
});

// Display available rooms
const availableRooms = data.rooms.filter(room => room.isAvailable);
availableRooms.forEach(room => {
  console.log(`${room.residenceName} - Room ${room.roomNumber}: $${room.price}`);
});
```

### React Component Example
```jsx
import React, { useState, useEffect } from 'react';

function RoomOccupancyDisplay() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/public/applications/public-data')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Room Occupancy Status</h2>
      <div className="stats">
        <p>Overall Occupancy: {data.statistics.rooms.overallOccupancyRate}%</p>
        <p>Available Rooms: {data.statistics.rooms.available}</p>
      </div>
      
      <div className="residences">
        {data.residences.map(residence => (
          <div key={residence.id} className="residence">
            <h3>{residence.name}</h3>
            <p>Occupancy Rate: {residence.occupancyRate}%</p>
            <p>Available: {residence.availableRooms}/{residence.totalRooms}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Testing

### Test Scripts
1. **Basic Test**: `node test-public-application-data.js`
2. **Comprehensive Test**: `node test-room-occupancy-status.js`

### Manual Testing
```bash
# Test the endpoint
curl -X GET "http://localhost:5000/api/public/applications/public-data"

# Test with filters
curl -X GET "http://localhost:5000/api/public/applications/public-data?residence=Belvedere"
curl -X GET "http://localhost:5000/api/public/applications/public-data?status=approved"
```

## Security Considerations

- **Public Access**: This endpoint is intentionally public and does not require authentication
- **No Sensitive Data**: Only non-sensitive information is exposed (no personal details, passwords, etc.)
- **Read-Only**: This endpoint only provides read access to room and application data
- **Rate Limiting**: Consider implementing rate limiting for production use

## Performance

- **Caching**: Consider implementing caching for frequently accessed data
- **Pagination**: For large datasets, consider adding pagination support
- **Real-time Updates**: Data is fetched in real-time from the database

## Error Handling

The API returns appropriate HTTP status codes:
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `500`: Server Error

Error responses include:
```json
{
  "success": false,
  "error": "Server error",
  "message": "Detailed error message"
}
```

## Future Enhancements

1. **WebSocket Support**: Real-time updates for room status changes
2. **Caching Layer**: Redis caching for improved performance
3. **Pagination**: Support for large datasets
4. **Advanced Filtering**: More sophisticated filtering options
5. **Analytics**: Historical occupancy trends and analytics 