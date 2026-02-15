const { spawn, execSync } = require('child_process');
const axios = require('axios');

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

const tests = [
  { name: 'Scenario Tests', script: 'scenario-tests.js' },
  { name: 'Edge Case Tests', script: 'edge-case-tests.js' },
  { name: 'Realistic Load Test', script: 'realistic-load-test.js' }
];

/**
 * Check if server is running
 */
async function checkServerRunning() {
  try {
    console.log('🔍 Checking if server is running...');
    await axios.get(`${baseUrl}/health`, { timeout: 3000 });
    console.log('✅ Server is running\n');
    return true;
  } catch (error) {
    console.error('❌ Server is not running at', baseUrl);
    console.error('   Please start the server with: npm run dev\n');
    process.exit(1);
  }
}

/**
 * Seed database with test data
 */
function seedDatabase() {
  try {
    console.log('🌱 Seeding database with test data...');
    console.log('   (Creates 20 cabs + 200 rides with bookings)\n');
    execSync('npm run seed', { stdio: 'inherit' });
    console.log('✅ Database seeded - ready for tests\n');
    return true;
  } catch (error) {
    console.error('❌ Database seeding failed');
    return false;
  }
}

/**
 * Run a single test script
 */
async function runTest(script) {
  return new Promise((resolve, reject) => {
    const process = spawn('node', [`scripts/${script}`], { shell: true });
    
    process.stdout.on('data', (data) => {
      console.log(data.toString());
    });
    
    process.stderr.on('data', (data) => {
      console.error(data.toString());
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Test failed with exit code ${code}`));
      }
    });

    process.on('error', (error) => {
      reject(new Error(`Failed to start test: ${error.message}`));
    });
  });
}

/**
 * Run all tests sequentially
 */
async function runAllTests() {
  const startTime = Date.now();
  let passedTests = 0;
  let failedTests = 0;

  console.log('\n' + '='.repeat(80));
  console.log('🚀 RUNNING COMPLETE TEST SUITE');
  console.log('='.repeat(80) + '\n');
  
  // Check server and seed (no reset needed - seed does it all)
  await checkServerRunning();
  seedDatabase();
  
  // Run each test
  for (const test of tests) {
    console.log('\n' + '='.repeat(80));
    console.log(`▶️  Running: ${test.name}`);
    console.log('='.repeat(80));
    
    try {
      await runTest(test.script);
      console.log(`\n✅ ${test.name} completed`);
      passedTests++;
    } catch (error) {
      console.error(`\n❌ ${test.name} failed:`, error.message);
      failedTests++;
    }
    
    // Wait 2 seconds between tests
    if (tests.indexOf(test) < tests.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Print summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('\n' + '='.repeat(80));
  console.log('🎉 ALL TESTS COMPLETED');
  console.log('='.repeat(80));
  console.log(`\n📊 Summary:`);
  console.log(`   Total: ${tests.length} test suites`);
  console.log(`   ✅ Passed: ${passedTests}`);
  if (failedTests > 0) {
    console.log(`   ❌ Failed: ${failedTests}`);
  }
  console.log(`   ⏱️  Duration: ${duration}s\n`);

  // Exit with error code if any tests failed
  if (failedTests > 0) {
    process.exit(1);
  }
}

// Run all tests
runAllTests().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
