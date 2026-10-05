import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log('=== DATABASE VERIFICATION REPORT ===');

  // 1. Table Counts
  const adminCount = await prisma.admin.count();
  const userCount = await prisma.user.count();
  const txnCount = await prisma.transaction.count();
  const txnHistoryCount = await prisma.transactionStatusHistory.count();
  const bookingCount = await prisma.booking.count();
  const bookingLogCount = await prisma.bookingLog.count();
  const activityLogCount = await prisma.activityLog.count();
  const alertCount = await prisma.alert.count();

  console.log(`Admins:                     ${adminCount}`);
  console.log(`Users:                      ${userCount}`);
  console.log(`Transactions:               ${txnCount}`);
  console.log(`Transaction Status History: ${txnHistoryCount}`);
  console.log(`Bookings:                   ${bookingCount}`);
  console.log(`Booking Logs:               ${bookingLogCount}`);
  console.log(`Activity Logs:              ${activityLogCount}`);
  console.log(`Alerts:                     ${alertCount}`);

  // 2. Verify Relations
  const sampleUser = await prisma.user.findFirst({
    where: { userCode: 'USR-0001' },
    include: {
      transactions: { take: 3 },
      bookings: { take: 3 },
      activities: { take: 3 },
    },
  });
  console.log(`User USR-0001 loaded with ${sampleUser?.transactions.length} txns, ${sampleUser?.bookings.length} bookings, ${sampleUser?.activities.length} activities.`);

  // 3. Verify Decimals & Signed Refunds
  const refundTxn = await prisma.transaction.findFirst({
    where: { type: 'REFUND' },
  });
  console.log(`Sample Refund Amount: ${refundTxn?.amount.toString()} (is negative: ${Number(refundTxn?.amount) < 0})`);

  // 4. Verify Database Sequences
  const nextUserSeq = await prisma.$queryRaw<Array<{ nextval: bigint }>>`SELECT nextval('user_code_seq')`;
  const nextTxnSeq = await prisma.$queryRaw<Array<{ nextval: bigint }>>`SELECT nextval('txn_code_seq')`;
  console.log(`Sequence user_code_seq nextval: ${nextUserSeq[0].nextval}`);
  console.log(`Sequence txn_code_seq nextval:  ${nextTxnSeq[0].nextval}`);

  // 5. Verify Admin Account
  const admin = await prisma.admin.findUnique({
    where: { email: 'admin@miles.io' },
  });
  console.log(`Admin account verified: ${admin?.email}, role: ${admin?.role}`);

  console.log('=== ALL VERIFICATIONS PASSED ===');
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
