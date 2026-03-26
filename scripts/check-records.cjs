const fs = require('fs');
const records = JSON.parse(fs.readFileSync('data/records.json', 'utf8'));
const now = new Date('2026-03-26');
const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

console.log('=== CHECKING RECORDS FOR COWORKING SESSIONS ===\n');

const recentRecords = records.filter(r => {
  const created = new Date(r.date);
  return created >= fiveDaysAgo;
});

console.log('Total records in last 5 days:', recentRecords.length);

const coworkingRecords = records.filter(r =>
  r.service === 'coworking' ||
  (r.notes && r.notes.toLowerCase().includes('coworking'))
);

console.log('Total coworking records (all time):', coworkingRecords.length);

const recentCoworking = recentRecords.filter(r =>
  r.service === 'coworking' ||
  (r.notes && r.notes.toLowerCase().includes('coworking'))
);

console.log('Coworking records in last 5 days:', recentCoworking.length);
console.log('');

if (recentCoworking.length > 0) {
  console.log('✅ FOUND COWORKING RECORDS FROM LAST 5 DAYS:\n');
  recentCoworking.forEach((record, i) => {
    const created = new Date(record.date);
    const daysAgo = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    console.log(`${i + 1}. Client: ${record.client}`);
    console.log(`   Date: ${created.toISOString()} (${daysAgo} days ago)`);
    console.log(`   Hours: ${record.hours}`);
    console.log(`   Total: $${record.total}`);
    console.log(`   Service Charge: $${record.serviceCharge}`);
    console.log(`   Payment: ${record.payment}`);
    console.log('');
  });
} else if (coworkingRecords.length > 0) {
  console.log('❌ No coworking records in last 5 days, but found', coworkingRecords.length, 'older ones');
  console.log('\nMost recent coworking record:');
  const sorted = coworkingRecords.sort((a,b) => new Date(b.date) - new Date(a.date));
  const mostRecent = sorted[0];
  console.log('  Client:', mostRecent.client);
  console.log('  Date:', new Date(mostRecent.date).toISOString());
  console.log('  Hours:', mostRecent.hours);
  console.log('  Total: $', mostRecent.total);
}

// Show breakdown of ALL records by date
console.log('\n=== ALL RECORDS TIMELINE ===');
const recordsByMonth = {};
records.forEach(r => {
  const date = new Date(r.date);
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  recordsByMonth[monthKey] = (recordsByMonth[monthKey] || 0) + 1;
});

Object.keys(recordsByMonth).sort().forEach(month => {
  console.log(`  ${month}: ${recordsByMonth[month]} records`);
});

console.log('\nMost recent record (any type):');
const allSorted = records.sort((a,b) => new Date(b.date) - new Date(a.date));
if (allSorted.length > 0) {
  const latest = allSorted[0];
  console.log('  Date:', new Date(latest.date).toISOString());
  console.log('  Client:', latest.client);
  console.log('  Service:', latest.service || 'N/A');
  console.log('  Total: $', latest.total);
}
