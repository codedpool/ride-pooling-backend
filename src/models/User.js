const db = require('../config/database');

class User {
  static async create(name, phone) {
    const query = `
      INSERT INTO users (name, phone)
      VALUES ($1, $2)
      RETURNING *
    `;
    const result = await db.query(query, [name, phone]);
    return result.rows[0];
  }

  static async findById(id) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async findByPhone(phone) {
    const query = 'SELECT * FROM users WHERE phone = $1';
    const result = await db.query(query, [phone]);
    return result.rows[0];
  }
}

module.exports = User;
