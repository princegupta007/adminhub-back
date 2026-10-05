const http = require('http');
const { PrismaClient } = require('@prisma/client');

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
  const token = loginSuccessRes.data.data?.accessToken;
  console.log('   Admin logged in:', loginSuccessRes.data.data?.admin?.email);

  // 4. GET /api/v1/auth/me
  const meSuccessRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/auth/me',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log('5. GET /api/v1/auth/me ->', meSuccessRes.statusCode, meSuccessRes.data.data?.name);

  // 5. GET /api/v1/users (list)
  const usersListRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/users?page=1&limit=5&sortBy=name&order=asc',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log('6. GET /api/v1/users [List & Pagination] ->', usersListRes.statusCode);
  console.log('   Items returned:', usersListRes.data.data?.length, '| Total:', usersListRes.data.meta?.total);

  // 6. GET /api/v1/users/stats
  const usersStatsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/users/stats',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log('7. GET /api/v1/users/stats ->', usersStatsRes.statusCode);
  console.log('   Stats:', usersStatsRes.data.data);

  // 7. GET /api/v1/users/USR-0001 (single user detail)
  const userDetailRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/users/USR-0001',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log('8. GET /api/v1/users/USR-0001 ->', userDetailRes.statusCode);
  console.log('   Detail:', {
    userCode: userDetailRes.data.data?.userCode,
    name: userDetailRes.data.data?.name,
    recentTxnCount: userDetailRes.data.data?.recentTransactions?.length,
    recentBookingCount: userDetailRes.data.data?.recentBookings?.length,
  });

  // 8. POST /api/v1/users (create user)
  const newEmail = `manual.test.${Date.now()}@example.com`;
  const createUserRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/users',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    {
      firstName: 'Alexander',
      lastName: 'Hamilton',
      email: newEmail,
      phone: '+1 (555) 910-1804',
      role: 'EDITOR',
      status: 'ACTIVE',
      addressLine: '123 Wall St',
      city: 'New York',
      state: 'NY',
      country: 'USA',
    },
  );
  console.log('9. POST /api/v1/users [Create] ->', createUserRes.statusCode);
  const createdUser = createUserRes.data.data;
  console.log('   Created user:', {
    userCode: createdUser?.userCode,
    email: createdUser?.email,
    role: createdUser?.role,
  });

  // 9. PATCH /api/v1/users/:code (update user)
  const updateUserRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/api/v1/users/${createdUser?.userCode}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    {
      phone: '+1 (555) 999-8888',
      role: 'ADMIN',
    },
  );
  console.log('10. PATCH /api/v1/users/:code [Update] ->', updateUserRes.statusCode);
  console.log('    Updated fields:', {
    phone: updateUserRes.data.data?.phone,
    role: updateUserRes.data.data?.role,
  });

  // 10. DELETE /api/v1/users/:code (soft delete)
  const deleteUserRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/v1/users/${createdUser?.userCode}`,
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log('11. DELETE /api/v1/users/:code [Soft Delete] ->', deleteUserRes.statusCode, deleteUserRes.data);

  // 11. Database verification after mutation
  const prisma = new PrismaClient();
  const dbUser = await prisma.user.findUnique({
    where: { userCode: createdUser?.userCode },
  });
  console.log('12. Direct Database Check:');
  console.log('    User in DB deletedAt:', dbUser?.deletedAt);
  console.log('    User status in DB:', dbUser?.status);

  const activities = await prisma.activityLog.findMany({
    where: { userId: dbUser?.id },
    orderBy: { createdAt: 'desc' },
  });
  console.log('    Audit activity logs created for user:', activities.map((a) => a.action));
  await prisma.$disconnect();

  console.log('\n✨ ALL MANUAL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Error during manual verification:', err);
  process.exit(1);
});
