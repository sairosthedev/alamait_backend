const http = require('http');

function testEndpoint() {
  console.log('🧪 TESTING FIXED ENDPOINT');
  console.log('===========================\n');
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/finance/accounts/next-code?type=Asset&category=Current%20Assets',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('\nResponse Body:');
      try {
        const jsonData = JSON.parse(data);
        console.log(JSON.stringify(jsonData, null, 2));
      } catch (e) {
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Request error: ${e.message}`);
  });

  req.end();
}

// Wait a bit for server to start, then test
setTimeout(testEndpoint, 3000);
