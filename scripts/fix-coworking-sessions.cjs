const fs = require('fs').promises;
const path = require('path');

async function fixCoworkingSessions() {
  const dataPath = path.join(__dirname, '..', 'data', 'coworking_sessions.json');

  console.log('Reading coworking sessions...');
  const data = await fs.readFile(dataPath, 'utf8');
  const sessions = JSON.parse(data);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let futureStartCount = 0;
  let futureEndCount = 0;
  let orphanedCount = 0;

  const fixedSessions = sessions.map(session => {
    const fixed = { ...session };
    let modified = false;

    // Fix future start times
    if (new Date(session.startTime) > now) {
      console.log(`Fixing future start time: ${session._id} - ${session.client}`);
      fixed.startTime = now.toISOString();
      futureStartCount++;
      modified = true;
    }

    // Fix future end times
    if (session.endTime && new Date(session.endTime) > now) {
      console.log(`Fixing future end time: ${session._id} - ${session.client}`);
      fixed.endTime = now.toISOString();
      futureEndCount++;
      modified = true;
    }

    // Close orphaned active sessions
    if (session.status === 'active' && new Date(session.createdAt) < sevenDaysAgo) {
      console.log(`Closing orphaned session: ${session._id} - ${session.client}`);
      const startTime = new Date(session.startTime);
      const twoHoursLater = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
      fixed.endTime = twoHoursLater.toISOString();
      fixed.status = 'closed';
      fixed.payment = 'efectivo';
      fixed.notes = (session.notes || '') + ' [Auto-closed: orphaned session]';
      orphanedCount++;
      modified = true;
    }

    if (modified) {
      fixed.updatedAt = now.toISOString();
    }

    return fixed;
  });

  console.log(`\nSummary:`);
  console.log(`- Fixed future start times: ${futureStartCount}`);
  console.log(`- Fixed future end times: ${futureEndCount}`);
  console.log(`- Closed orphaned sessions: ${orphanedCount}`);

  if (futureStartCount + futureEndCount + orphanedCount > 0) {
    await fs.writeFile(dataPath, JSON.stringify(fixedSessions, null, 2));
    console.log('✅ Data fixed successfully!');
  } else {
    console.log('✅ No issues found!');
  }

  // Verification
  const activeCount = fixedSessions.filter(s => s.status === 'active').length;
  const futureStartsCount = fixedSessions.filter(s => new Date(s.startTime) > now).length;
  const futureEndsCount = fixedSessions.filter(s => s.endTime && new Date(s.endTime) > now).length;

  console.log(`\nVerification:`);
  console.log(`- Total sessions: ${fixedSessions.length}`);
  console.log(`- Active sessions: ${activeCount}`);
  console.log(`- Future start times: ${futureStartsCount}`);
  console.log(`- Future end times: ${futureEndsCount}`);
}

fixCoworkingSessions().catch(console.error);
