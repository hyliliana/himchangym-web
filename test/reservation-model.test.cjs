const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(file){const module={exports:{}};const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('exports','module','require',output)(module.exports,module,require);return module.exports;}
const {monthCells,shiftMonth}=load('app/lib/availability.ts');
const {bookingNotice,reservationLabel}=load('app/lib/reservations.ts');
test('month navigation preserves months across year and leap-year boundaries',()=>{
  assert.equal(shiftMonth('2026-12',1),'2027-01');assert.equal(shiftMonth('2027-01',-1),'2026-12');
  assert.equal(monthCells('2028-02',[]).days.length,29);assert.equal(monthCells('2027-02',[]).days.length,28);
  assert.equal(monthCells('2026-11',[]).firstDay,0);
});
test('calendar enables only dates with nonempty server slots in the displayed month',()=>{
  const slot={id:1,startsAt:'2026-11-07T01:00:00.000Z',endsAt:'2026-11-07T02:00:00.000Z'};
  const cells=monthCells('2026-11',[{date:'2026-11-07',slots:[slot]},{date:'2026-11-08',slots:[]},{date:'2026-12-01',slots:[slot]}]);
  assert.deepEqual(cells.days.filter(day=>day.available).map(day=>day.date),['2026-11-07']);
  assert.equal(cells.days.length,30);assert.equal(cells.days.at(-1).date,'2026-11-30');
});
test('pending schedule change never replaces the current reservation label',()=>{
  const reservation={status:'booked',approval:'approved',pendingChange:{id:1,startsAt:'2026-11-08T10:00:00+09:00',requestedAt:'2026-11-06T10:00:00+09:00'}};
  assert.equal(reservationLabel(reservation),'예약 확정');assert.equal(reservationLabel({...reservation,approval:'pending'}),'트레이너 승인 대기');
});
test('booking notices only claim confirmation for explicit server approval',()=>{
  assert.match(bookingNotice({approval:'pending'}),/승인 대기/);assert.match(bookingNotice({approval:'approved'}),/확정/);assert.doesNotMatch(bookingNotice(undefined),/확정/);assert.doesNotMatch(bookingNotice({}),/확정/);
});
