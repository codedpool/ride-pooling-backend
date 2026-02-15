const db = require('../config/database');

class Cab {
    static async findAll() {
      const query = `
        SELECT id, driver_name, vehicle_number, total_seats, total_luggage_capacity,
               ST_X(current_location::geometry) as lon, 
               ST_Y(current_location::geometry) as lat,
               created_at
        FROM cabs
        ORDER BY created_at DESC
      `;
      const result = await db.query(query);
      return result.rows;
    }
  static async create(driverName, vehicleNumber, lat, lon) {
    const query = `
      INSERT INTO cabs (driver_name, vehicle_number, current_location)
      VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326))
      RETURNING id, driver_name, vehicle_number, total_seats, total_luggage_capacity, 
                ST_X(current_location::geometry) as lon, 
                ST_Y(current_location::geometry) as lat,
                is_active, created_at
    `;
    const result = await db.query(query, [driverName, vehicleNumber, lon, lat]);
    return result.rows[0];
  }

  static async findById(id) {
    const query = `
      SELECT id, driver_name, vehicle_number, total_seats, total_luggage_capacity,
             ST_X(current_location::geometry) as lon, 
             ST_Y(current_location::geometry) as lat,
             created_at
      FROM cabs WHERE id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async findNearby(lat, lon, radiusKm = 5) {
    const query = `
      SELECT id, driver_name, vehicle_number, total_seats, total_luggage_capacity,
             ST_X(current_location::geometry) as lon, 
             ST_Y(current_location::geometry) as lat,
             ST_Distance(current_location::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) / 1000 as distance_km
      FROM cabs
      WHERE ST_DWithin(current_location::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
      ORDER BY distance_km
    `;
    const result = await db.query(query, [lat, lon, radiusKm * 1000]);
    return result.rows;
  }

  static async updateLocation(id, lat, lon) {
    const query = `
      UPDATE cabs
      SET current_location = ST_SetSRID(ST_MakePoint($2, $3), 4326)
      WHERE id = $1
      RETURNING id, driver_name, vehicle_number,
                ST_X(current_location::geometry) as lon, 
                ST_Y(current_location::geometry) as lat
    `;
    const result = await db.query(query, [id, lon, lat]);
    return result.rows[0];
  }
}

module.exports = Cab;
