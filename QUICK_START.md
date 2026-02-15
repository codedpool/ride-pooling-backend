# 🚀 Quick Start Reference

## First Time Setup

```bash
git clone <your-repo>
cd airport-ride-pooling
npm run setup        # Does everything!
npm run dev          # Start server
```

---

## Testing

```bash
npm run test:all            # Run all tests (recommended)
npm run test:realistic      # Realistic load test
npm run test:scenarios      # Functional tests
npm run test:edge          # Edge case tests
```

---

## Daily Development

```bash
npm run dev                # Start dev server
npm run docker:logs        # View DB logs
npm run seed               # Reset test data
```

---

## Troubleshooting

```bash
npm run docker:restart     # Restart DB
npm run clean             # Clean everything
npm run setup             # Fresh start
```

---

## API Testing

```bash
# Health check
curl http://localhost:3000/health

# Book a ride
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

---

## 📋 Prerequisites

- **Node.js** 22.x or higher
- **Docker** & **Docker Compose**
- **Git**

---

## 🔗 Full Documentation

See [README.md](README.md) for complete documentation.
