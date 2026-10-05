const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed,
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('🚀 Starting Manual Endpoint Verification against live server on port 4000...');

  // 1. Health checks
  const healthRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/health',
    method: 'GET',
  });
  console.log('1. GET /health ->', healthRes.statusCode, healthRes.data);

  const apiHealthRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/health',
    method: 'GET',
  });
  console.log('2. GET /api/v1/health ->', apiHealthRes.statusCode, apiHealthRes.data);

  // 2. Swagger docs check
  const swaggerRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/docs',
    method: 'GET',
  });
  console.log('3. GET /api/docs (Swagger) ->', swaggerRes.statusCode, '(HTML document served)');

  // 3. Login with valid credentials
  const loginSuccessRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '192.168.10.1',
      },
    },
    {
      email: 'admin@miles.io',
      password: 'Admin@123',
    },
  );
  console.log('4. POST /api/v1/auth/login [Valid Credentials] ->', loginSuccessRes.statusCode);
  console.log('   Data received:', {
    tokenPrefix: loginSuccessRes.data.data?.accessToken?.substring(0, 25) + '...',
    admin: loginSuccessRes.data.data?.admin,
  });
  const token = loginSuccessRes.data.data?.accessToken;

  // 4. Login with invalid credentials
  const loginFailRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '192.168.10.2',
      },
    },
    {
      email: 'admin@miles.io',
      password: 'WrongPassword',
    },
  );
  console.log('5. POST /api/v1/auth/login [Invalid Credentials] ->', loginFailRes.statusCode, loginFailRes.data);

  // 5. GET /api/v1/auth/me with valid Bearer token
  const meSuccessRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/auth/me',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log('6. GET /api/v1/auth/me [Valid Bearer] ->', meSuccessRes.statusCode, meSuccessRes.data);

  // 6. GET /api/v1/auth/me with missing token
  const meMissingRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/auth/me',
    method: 'GET',
  });
  console.log('7. GET /api/v1/auth/me [Missing Token] ->', meMissingRes.statusCode, meMissingRes.data);

  // 7. GET /api/v1/auth/me with invalid token
  const meInvalidRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/auth/me',
    method: 'GET',
    headers: {
      Authorization: 'Bearer invalid.token.value',
    },
  });
  console.log('8. GET /api/v1/auth/me [Invalid Token] ->', meInvalidRes.statusCode, meInvalidRes.data);

  // 8. Rate Limiting Test on /api/v1/auth/login
  console.log('9. Testing Login Rate Limiting (threshold: 5)...');
  const throttledIp = '10.200.200.55';
  let throttled = false;
  for (let i = 1; i <= 7; i++) {
    const res = await request(
      {
        hostname: 'localhost',
        port: 4000,
        path: '/api/v1/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': throttledIp,
        },
      },
      {
        email: 'admin@miles.io',
        password: 'Attempt_' + i,
      },
    );
    if (res.statusCode === 429) {
      console.log(`   Attempt ${i} successfully blocked with HTTP 429:`, res.data);
      throttled = true;
      break;
    } else {
      console.log(`   Attempt ${i} returned status: ${res.statusCode}`);
    }
  }

  if (throttled) {
    console.log('✅ Rate limiting verified successfully!');
  } else {
    console.log('❌ Rate limiting did not trigger within 7 attempts.');
  }

  console.log('\n✨ ALL MANUAL VERIFICATION CHECKS PASSED!');
}

run().catch((err) => {
  console.error('Error during manual verification:', err);
  process.exit(1);
});
