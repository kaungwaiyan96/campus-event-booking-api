import app from '../src/app';
import prisma from '../src/config/prisma';
import http from 'http';

async function runTests() {
  console.log('\n--- STARTING AUTOMATED INTEGRATION TESTS ---\n');

  // Pre-cleanup of any prior test artifacts
  await prisma.booking.deleteMany({ where: { student: { email: 'student2_test@campus.edu' } } });
  await prisma.user.deleteMany({ where: { email: 'student2_test@campus.edu' } });

  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(5099, resolve));
  const baseUrl = 'http://localhost:5099/events-api/v1';

  let eventId: string | undefined;
  let student2Id: string | undefined;

  try {
    // 1. Fetch seed users
    const student = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
    const organizer = await prisma.user.findFirst({ where: { role: 'ORGANIZER' } });
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    if (!student || !organizer || !admin) {
      throw new Error('Seed users missing. Run npm run prisma:seed first.');
    }

    console.log('✓ Found seed users for test execution.');

    // 2. Health check
    const healthRes: any = await fetch(`${baseUrl}/health`).then((r) => r.json());
    if (healthRes.status !== 'healthy') throw new Error('Health check failed');
    console.log('✓ Health check passed.');

    // 3. Organizer creates event
    const createEventRes: any = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': organizer.id,
      },
      body: JSON.stringify({
        title: 'Concurrency Test Seminar',
        description: 'Testing race conditions and booking transactions',
        venueName: 'Room 101',
        venueAddress: 'Science Building',
        startTime: new Date(Date.now() + 1000000).toISOString(),
        endTime: new Date(Date.now() + 2000000).toISOString(),
        capacity: 1, // Only 1 seat!
      }),
    }).then((r) => r.json());

    if (!createEventRes.success) throw new Error('Create event failed: ' + JSON.stringify(createEventRes));
    eventId = createEventRes.data.id;
    console.log('✓ Organizer successfully created event with capacity 1.');

    // 4. Student 1 books the only seat
    const bookRes1: any = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': student.id,
      },
      body: JSON.stringify({ eventId }),
    }).then((r) => r.json());

    if (!bookRes1.success) throw new Error('First booking failed: ' + JSON.stringify(bookRes1));
    const bookingId = bookRes1.data.id;
    console.log('✓ Student 1 successfully RSVP-ed for the only seat.');

    // 5. Duplicate booking check (Student 1 tries again)
    const duplicateRes: any = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': student.id,
      },
      body: JSON.stringify({ eventId }),
    }).then((r) => r.json());

    if (duplicateRes.success || duplicateRes.error?.code !== 'ALREADY_BOOKED') {
      throw new Error('Duplicate booking check failed: ' + JSON.stringify(duplicateRes));
    }
    console.log('✓ Duplicate booking prevented (ALREADY_BOOKED).');

    // 6. Overcapacity check: Create a second student and try to book full event
    const student2 = await prisma.user.create({
      data: {
        adOid: 'ad-student-002-test',
        name: 'Second Student',
        email: 'student2_test@campus.edu',
        role: 'STUDENT',
      },
    });
    student2Id = student2.id;

    const fullRes: any = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': student2.id,
      },
      body: JSON.stringify({ eventId }),
    }).then((r) => r.json());

    if (fullRes.success || fullRes.error?.code !== 'CAPACITY_EXCEEDED') {
      throw new Error('Capacity check failed: ' + JSON.stringify(fullRes));
    }
    console.log('✓ Capacity limit enforced (CAPACITY_EXCEEDED).');

    // 7. Cancel booking and check capacity liberation
    const cancelRes: any = await fetch(`${baseUrl}/bookings/${bookingId}`, {
      method: 'DELETE',
      headers: {
        'x-user-id': student.id,
      },
    }).then((r) => r.json());

    if (!cancelRes.success) throw new Error('Cancellation failed: ' + JSON.stringify(cancelRes));
    console.log('✓ Student 1 cancelled booking successfully.');

    // 8. Student 2 now books the freed seat
    const bookRes2: any = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': student2.id,
      },
      body: JSON.stringify({ eventId }),
    }).then((r) => r.json());

    if (!bookRes2.success) throw new Error('Rebooking freed seat failed: ' + JSON.stringify(bookRes2));
    console.log('✓ Student 2 successfully booked freed seat.');

    // 9. Organizer views attendees
    const attendeesRes: any = await fetch(`${baseUrl}/events/${eventId}/attendees`, {
      headers: {
        'x-user-id': organizer.id,
      },
    }).then((r) => r.json());

    if (!attendeesRes.success || attendeesRes.data?.length !== 1) {
      throw new Error('Attendees check failed: ' + JSON.stringify(attendeesRes));
    }
    console.log('✓ Organizer attendee list correctly verified (1 confirmed attendee).');

    // 10. 404 Catch-all verification
    const notFoundRes: any = await fetch(`${baseUrl}/undefined-route-test`).then((r) => r.json());
    if (notFoundRes.success || notFoundRes.error?.code !== 'NOT_FOUND') {
      throw new Error('404 catch-all check failed: ' + JSON.stringify(notFoundRes));
    }
    console.log('✓ Catch-all 404 handler verified (NOT_FOUND).');

    // 11. Malformed JSON syntax error verification
    const badJsonRes: any = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': organizer.id,
      },
      body: '{"invalidJson": ',
    }).then((r) => r.json());
    if (badJsonRes.success || badJsonRes.error?.code !== 'INVALID_JSON') {
      throw new Error('Malformed JSON check failed: ' + JSON.stringify(badJsonRes));
    }
    console.log('✓ Malformed JSON parser error caught (INVALID_JSON).');

    // 12. Capacity < 1 update validation
    const invalidCapRes: any = await fetch(`${baseUrl}/events/${eventId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': organizer.id,
      },
      body: JSON.stringify({ capacity: 0 }),
    }).then((r) => r.json());
    if (invalidCapRes.success || invalidCapRes.error?.code !== 'INVALID_CAPACITY') {
      throw new Error('Capacity < 1 validation check failed: ' + JSON.stringify(invalidCapRes));
    }
    console.log('✓ Capacity < 1 update validation enforced (INVALID_CAPACITY).');

    // 13. Date query filter verification
    const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dateFilteredRes: any = await fetch(`${baseUrl}/events?date=${tomorrowStr}`).then((r) => r.json());
    if (!dateFilteredRes.success || !Array.isArray(dateFilteredRes.data)) {
      throw new Error('Date filter query failed: ' + JSON.stringify(dateFilteredRes));
    }
    console.log(`✓ Event date filter query verified (${dateFilteredRes.data.length} events returned for ${tomorrowStr}).`);

    console.log('\n--- ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ---\n');
  } finally {
    // Safe cleanup of test resources in finally block
    if (eventId) {
      await prisma.booking.deleteMany({ where: { eventId } }).catch(() => {});
      await prisma.event.delete({ where: { id: eventId } }).catch(() => {});
    }
    if (student2Id) {
      await prisma.booking.deleteMany({ where: { studentId: student2Id } }).catch(() => {});
      await prisma.user.delete({ where: { id: student2Id } }).catch(() => {});
    }
    server.close();
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
