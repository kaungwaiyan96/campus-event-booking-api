import { PrismaClient, Role, BookingStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial database records...');

  // 1. Clean existing records in cascade order
  await prisma.booking.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create Users
  const student = await prisma.user.create({
    data: {
      id: '11111111-1111-1111-1111-111111111111',
      adOid: 'ad-student-001',
      name: 'Mg Student',
      email: 'student@campus.edu',
      role: Role.STUDENT,
    },
  });

  const organizer = await prisma.user.create({
    data: {
      id: '22222222-2222-2222-2222-222222222222',
      adOid: 'ad-organizer-001',
      name: 'Daw Organizer',
      email: 'organizer@campus.edu',
      role: Role.ORGANIZER,
    },
  });

  const admin = await prisma.user.create({
    data: {
      id: '33333333-3333-3333-3333-333333333333',
      adOid: 'ad-admin-001',
      name: 'U Admin',
      email: 'admin@campus.edu',
      role: Role.ADMIN,
    },
  });

  // 3. Create Events
  const now = new Date();
  const event1 = await prisma.event.create({
    data: {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: 'Tech Career Fair 2026',
      description: 'Annual campus tech career fair and recruitment sessions with top tech firms.',
      venueName: 'Main Auditorium',
      venueAddress: 'Building A, Level 2, Central Campus',
      mapImageUrl: 'https://maps.googleapis.com/maps/api/staticmap?center=Main+Auditorium&zoom=15&size=600x300',
      startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000), // tomorrow
      endTime: new Date(now.getTime() + 28 * 60 * 60 * 1000),
      capacity: 50,
      organizerId: organizer.id,
    },
  });

  const event2 = await prisma.event.create({
    data: {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      title: 'Cloud Architecture Workshop',
      description: 'Hands-on workshop covering cloud computing and container orchestration.',
      venueName: 'Lab Room 302',
      venueAddress: 'Engineering Complex, Level 3',
      startTime: new Date(now.getTime() + 48 * 60 * 60 * 1000), // in 2 days
      endTime: new Date(now.getTime() + 52 * 60 * 60 * 1000),
      capacity: 2, // low capacity to test overbooking
      organizerId: organizer.id,
    },
  });

  // 4. Create Initial Booking
  await prisma.booking.create({
    data: {
      eventId: event1.id,
      studentId: student.id,
      status: BookingStatus.CONFIRMED,
    },
  });

  console.log('Database seeding completed successfully:');
  console.log({ studentId: student.id, organizerId: organizer.id, adminId: admin.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
