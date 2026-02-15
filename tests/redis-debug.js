const redis = require('redis');

async function testRedis() {
  console.log('Testing Redis connection...\n');
  
  const client = redis.createClient({
    url: 'redis://localhost:6379'
  });

  client.on('error', err => console.error('Redis Error:', err));
  client.on('ready', () => console.log('✅ Redis Ready'));

  try {
    await client.connect();
    console.log('✅ Connected\n');

    console.log('Testing SET...');
    await client.set('test-key', 'hello', { EX: 10 });
    console.log('✅ SET successful\n');

    console.log('Testing GET...');
    const value = await client.get('test-key');
    console.log(`✅ GET successful: ${value}\n`);

    console.log('Testing INCR...');
    await client.incr('test-counter');
    const counter = await client.get('test-counter');
    console.log(`✅ INCR successful: ${counter}\n`);

    await client.disconnect();
    console.log('✅ All Redis operations working!');
  } catch (error) {
    console.error('❌ Redis test failed:', error);
  }
}

testRedis();
