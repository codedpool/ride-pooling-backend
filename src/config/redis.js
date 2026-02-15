const redis = require('redis');
require('dotenv').config();

let client;
let isReady = false;

async function createClient() {
  if (client) return client;

  client = redis.createClient({
    url: process.env.REDIS_URL
  });

  client.on('error', (err) => {
    console.error('Redis Client Error', err.message);
    isReady = false;
  });

  client.on('ready', () => {
    console.log('✅ Redis Connected');
    isReady = true;
  });

  try {
    await client.connect();
  } catch (err) {
    console.error('⚠️ Redis connect failed, continuing without Redis:', err.message);
    isReady = false;
  }

  return client;
}

// Immediately start connection in background
createClient();

module.exports = {
  getClient: () => client,
  isReady: () => isReady
};
