const { spawn } = require('child_process');

const tests = [
  { name: 'Scenario Tests', script: 'scenario-tests.js' },
  { name: 'Edge Case Tests', script: 'edge-case-tests.js' },
  { name: 'Realistic Load Test', script: 'realistic-load-test.js' }
];

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
        reject(new Error(`Test failed with code ${code}`));
      }
    });
  });
}

async function runAllTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 RUNNING COMPLETE TEST SUITE');
  console.log('='.repeat(80) + '\n');
  
  for (const test of tests) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`▶️  Running: ${test.name}`);
    console.log('='.repeat(80));
    
    try {
      await runTest(test.script);
      console.log(`\n✅ ${test.name} completed`);
    } catch (error) {
      console.error(`\n❌ ${test.name} failed:`, error.message);
    }
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🎉 ALL TESTS COMPLETED');
  console.log('='.repeat(80) + '\n');
}

runAllTests().catch(console.error);
