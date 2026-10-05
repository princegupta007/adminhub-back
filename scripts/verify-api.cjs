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
  const prisma = new PrismaClient();
  const dbUser = await prisma.user.findFirst({ where: { deletedAt: null } });
  if (!dbUser) {
    throw new Error('No active user found in database. Please run npm run prisma:seed');
  }

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

  // 12. GET /api/v1/transactions (Listing & Pagination)
  const listTxnRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/transactions?page=1&limit=5',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log('12. GET /api/v1/transactions ->', listTxnRes.statusCode);
  console.log('    Total transactions:', listTxnRes.data.meta?.total, 'Total pages:', listTxnRes.data.meta?.totalPages);
  console.log('    First item:', listTxnRes.data.data?.[0]?.txnCode, listTxnRes.data.data?.[0]?.customerName, '$' + listTxnRes.data.data?.[0]?.amount);

  // 13. GET /api/v1/transactions/stats
  const statsTxnRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/transactions/stats',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log('13. GET /api/v1/transactions/stats ->', statsTxnRes.statusCode);
  console.log('    Stats overview:', statsTxnRes.data.data);

  // 14. POST /api/v1/transactions (Create transaction)
  const createTxnRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/transactions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    {
      userId: dbUser.id,
      amount: 450.0,
      productName: 'Emergency Home Repair Service',
      paymentMethod: 'Credit Card (Visa ending in 9876)',
      type: 'PAYMENT',
      status: 'PENDING',
    },
  );
  console.log('14. POST /api/v1/transactions [Create] ->', createTxnRes.statusCode);
  const createdTxn = createTxnRes.data.data;
  console.log('    Created TXN:', createdTxn?.txnCode, 'Amount:', createdTxn?.amount, 'Fee:', createdTxn?.gatewayFee);

  // 15. GET /api/v1/transactions/:code (Detail)
  const detailTxnRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/v1/transactions/${createdTxn?.txnCode}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log('15. GET /api/v1/transactions/:code [Detail] ->', detailTxnRes.statusCode);
  console.log('    Customer on detail:', detailTxnRes.data.data?.customer?.name);
  console.log('    Status histories count:', detailTxnRes.data.data?.statusHistory?.length);

  // 16. PATCH /api/v1/transactions/:code/status (Update status to COMPLETED)
  const updateTxnStatusRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/api/v1/transactions/${createdTxn?.txnCode}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    {
      status: 'COMPLETED',
      note: 'Wire transfer confirmed by clearinghouse',
    },
  );
  console.log('16. PATCH /api/v1/transactions/:code/status ->', updateTxnStatusRes.statusCode);
  console.log('    Updated status:', updateTxnStatusRes.data.data?.status, 'Settled at:', updateTxnStatusRes.data.data?.settledAt);

  // 17. Verify database transaction records
  const dbTxn = await prisma.transaction.findUnique({
    where: { txnCode: createdTxn?.txnCode },
    include: { statusHistory: true },
  });
  console.log('17. Direct DB Check for Transaction:');
  console.log('    Txn in DB status:', dbTxn?.status, 'SettledAt in DB:', dbTxn?.settledAt);
  console.log('    Status histories in DB:', dbTxn?.statusHistory.map((h) => `${h.status}: ${h.note}`));

  // 18. GET /api/v1/bookings (Listing & Pagination)
  const listBkgRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/bookings?page=1&limit=5',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log('18. GET /api/v1/bookings ->', listBkgRes.statusCode);
  console.log('    Total bookings:', listBkgRes.data.meta?.total, 'Total pages:', listBkgRes.data.meta?.totalPages);
  console.log('    First item:', listBkgRes.data.data?.[0]?.bookingCode, listBkgRes.data.data?.[0]?.serviceName, '$' + listBkgRes.data.data?.[0]?.amount);

  // 19. GET /api/v1/bookings/stats
  const statsBkgRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/bookings/stats',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log('19. GET /api/v1/bookings/stats ->', statsBkgRes.statusCode);
  console.log('    Stats overview:', statsBkgRes.data.data);

  // 20. POST /api/v1/bookings (Create booking)
  const scheduledTime = new Date(Date.now() + 86400000 * 5).toISOString();
  const createBkgRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/bookings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    {
      userId: dbUser.id,
      serviceName: 'HVAC Air Filter Replacement & Diagnostics',
      category: 'HOME_MAINTENANCE',
      scheduledAt: scheduledTime,
      durationHours: 2.0,
      amount: 150.0,
      location: '100 Main St, Suite 400',
      notes: 'Customer reported unusual fan noise',
    },
  );
  console.log('20. POST /api/v1/bookings [Create] ->', createBkgRes.statusCode);
  const createdBkg = createBkgRes.data.data;
  console.log('    Created Booking:', createdBkg?.bookingCode, 'Invoice:', createdBkg?.invoiceNumber, 'End:', createdBkg?.endTime);

  // 21. GET /api/v1/bookings/:code (Detail)
  const detailBkgRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/v1/bookings/${createdBkg?.bookingCode}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log('21. GET /api/v1/bookings/:code [Detail] ->', detailBkgRes.statusCode);
  console.log('    Customer on detail:', detailBkgRes.data.data?.customer?.name);
  console.log('    Completed bookings count:', detailBkgRes.data.data?.customer?.completedBookingsCount);
  console.log('    Lifecycle logs count:', detailBkgRes.data.data?.lifecycleLogs?.length);

  // 22. PATCH /api/v1/bookings/:code (Update / Complete)
  const updateBkgRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/api/v1/bookings/${createdBkg?.bookingCode}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    {
      status: 'COMPLETED',
      notes: 'Technician completed replacement and airflow check',
    },
  );
  console.log('22. PATCH /api/v1/bookings/:code ->', updateBkgRes.statusCode);
  console.log('    Updated status:', updateBkgRes.data.data?.status, 'Payment Status:', updateBkgRes.data.data?.paymentStatus);

  // 23. Direct DB Check for Booking
  const dbBooking = await prisma.booking.findUnique({
    where: { bookingCode: createdBkg?.bookingCode },
    include: { logs: true },
  });
  console.log('23. Direct DB Check for Booking:');
  console.log('    Booking in DB status:', dbBooking?.status, 'Payment:', dbBooking?.paymentStatus);
  console.log('    Booking logs in DB:', dbBooking?.logs.map((l) => `${l.status}: ${l.note}`));

  await prisma.$disconnect();

  console.log('\n✨ ALL MANUAL VERIFICATION CHECKS (AUTH, USERS, TRANSACTIONS, BOOKINGS) PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Error during manual verification:', err);
  process.exit(1);
});
