
# 📋 |API Documentation|

---

## Base URL

```
http://localhost:3000
```

---

## Endpoints

### 1. Book a Ride

**POST** `/api/rides/book`

Books a ride for a user by finding the best matching available ride.

**Request Body:**
```json
{
  "userId": "452ef1bf-8064-4882-8071-c85cc4d3cb63",
  "pickupLat": 28.5565,
  "pickupLon": 77.1005,
  "dropoffLat": 28.6565,
  "dropoffLon": 77.2005,
  "luggageCount": 1
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "booking": {
      "id": "booking-uuid",
      "user_id": "452ef1bf-8064-4882-8071-c85cc4d3cb63",
      "ride_id": "ride-uuid",
      "luggage_count": 1,
      "fare": "197.97",
      "detour_distance": "0.30",
      "status": "confirmed",
      "created_at": "2026-02-15T10:30:00.000Z",
      "updated_at": "2026-02-15T10:30:00.000Z"
    },
    "ride": {
      "id": "ride-uuid",
      "cab_id": "cab-uuid",
      "status": "active",
      "available_seats": 2,
      "available_luggage": 3,
      "pickup_lat": "28.55650000",
      "pickup_lon": "77.10050000",
      "dropoff_lat": "28.65650000",
      "dropoff_lon": "77.20050000"
    },
    "pricing": {
      "fare": 197.97,
      "surgeMultiplier": 1.0,
      "baseFare": 197.97,
      "distance": 14.8
    },
    "detour": {
      "distance": 0.3,
      "percent": 2.0
    }
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "No available cabs found"
}
```

---

### 2. Get Booking Status
id (string, required): Booking UUID
id (string, required): Booking UUID
id (string, required): Cab UUID

---

### 2. Get Booking Status

**GET** `/api/rides/booking/:id`

Retrieves the status of a specific booking.

**URL Parameters:**
- `id` (string, required): Booking UUID

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "booking-uuid",
    "user_id": "user-uuid",
    "ride_id": "ride-uuid",
    "luggage_count": 1,
    "fare": "197.97",
    "detour_distance": "0.30",
    "status": "confirmed",
    "created_at": "2026-02-15T10:30:00.000Z",
    "ride": {
      "id": "ride-uuid",
      "cab_id": "cab-uuid",
      "driver_name": "Driver 1",
      "vehicle_number": "DL01XX0001"
    }
  }
}
```

---

### 3. Cancel Booking

**DELETE** `/api/rides/booking/:id`

Cancels an existing booking and returns the seat/luggage to the ride.

**URL Parameters:**
- `id` (string, required): Booking UUID

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "data": {
    "id": "booking-uuid",
    "status": "cancelled"
  }
}
```

---

### 4. Get All Active Rides

**GET** `/api/rides`

Retrieves all active rides with available capacity.

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "ride-uuid",
      "cab_id": "cab-uuid",
      "status": "active",
      "available_seats": 3,
      "available_luggage": 4,
      "pickup_lat": "28.55650000",
      "pickup_lon": "77.10050000",
      "dropoff_lat": "28.65650000",
      "dropoff_lon": "77.20050000",
      "total_distance": "15.00",
      "current_fare": "200.00"
    }
  ]
}
```

---

### 5. Get All Cabs

**GET** `/api/cabs`

Retrieves all registered cabs.

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "cab-uuid",
      "driver_name": "Driver 1",
      "vehicle_number": "DL01XX0001",
      "total_seats": 4,
      "total_luggage_capacity": 4,
      "status": "available"
    }
  ]
}
```

---

### 6. Get Cab by ID

**GET** `/api/cabs/:id`

Retrieves details of a specific cab.

**URL Parameters:**
- `id` (string, required): Cab UUID

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "cab-uuid",
    "driver_name": "Driver 1",
    "vehicle_number": "DL01XX0001",
    "total_seats": 4,
    "total_luggage_capacity": 4,
    "status": "available",
    "created_at": "2026-02-15T10:00:00.000Z"
  }
}
id (string, required): Cab UUID

---

### 7. Update Cab Location

**PUT** `/api/cabs/:id/location`

Updates the current location of a cab.

**URL Parameters:**
- `id` (string, required): Cab UUID

**Request Body:**
```json
{
  "lat": 28.5565,
  "lon": 77.1005
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Location updated successfully",
  "data": {
    "id": "cab-uuid",
    "current_location": "POINT(77.1005 28.5565)"
  }
}
```

---

### 8. Health Check

**GET** `/health`

Checks if the API is running.

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-02-15T10:30:00.000Z"
}
```

---

## Error Codes

| Code | Description                        |
|------|------------------------------------|
| 200  | Success                            |
| 201  | Created                            |
| 400  | Bad Request - Invalid input        |
| 404  | Not Found - Resource doesn't exist |
| 500  | Internal Server Error              |

---

## Rate Limits

- **Current:** No rate limiting (to be implemented with Redis)
- **Future:** 100 requests/minute per IP

---

## Testing with cURL

### Book a Ride
```bash
curl -X POST http://localhost:3000/api/rides/book \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "452ef1bf-8064-4882-8071-c85cc4d3cb63",
    "pickupLat": 28.5565,
    "pickupLon": 77.1005,
    "dropoffLat": 28.6565,
    "dropoffLon": 77.2005,
    "luggageCount": 1
  }'
```

### Get Booking Status
```bash
curl http://localhost:3000/api/rides/booking/{booking-id}
```

### Cancel Booking
```bash
curl -X DELETE http://localhost:3000/api/rides/booking/{booking-id}
```

### Get All Rides
```bash
curl http://localhost:3000/api/rides
```

---

## Postman Collection

Import this JSON into Postman:
```json
{
  "info": {
    "name": "Ride Pooling API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Book Ride",
      "request": {
        "method": "POST",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"userId\": \"452ef1bf-8064-4882-8071-c85cc4d3cb63\",\n  \"pickupLat\": 28.5565,\n  \"pickupLon\": 77.1005,\n  \"dropoffLat\": 28.6565,\n  \"dropoffLon\": 77.2005,\n  \"luggageCount\": 1\n}"
        },
        "url": {"raw": "http://localhost:3000/api/rides/book", "protocol": "http", "host": ["localhost"], "port": "3000", "path": ["api", "rides", "book"]}
      }
    },
    {
      "name": "Get Booking Status",
      "request": {
        "method": "GET",
        "url": {"raw": "http://localhost:3000/api/rides/booking/:id", "protocol": "http", "host": ["localhost"], "port": "3000", "path": ["api", "rides", "booking", ":id"], "variable": [{"key": "id", "value": ""}]}
      }
    },
    {
      "name": "Get All Rides",
      "request": {
        "method": "GET",
        "url": {"raw": "http://localhost:3000/api/rides", "protocol": "http", "host": ["localhost"], "port": "3000", "path": ["api", "rides"]}
      }
    }
  ]
}
```

---

