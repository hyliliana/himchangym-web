export type Slot={id:number;startsAt:string;endsAt:string};
export type AvailableDay={date:string;slots:Slot[]};
export function shiftMonth(month:string,offset:number){const d=new Date(`${month}-01T00:00:00Z`);d.setUTCMonth(d.getUTCMonth()+offset);return d.toISOString().slice(0,7);}
export function monthCells(month:string,availability:AvailableDay[]) {
  const firstDay=new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const dayCount=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
  return {firstDay,days:Array.from({length:dayCount},(_,i)=>{const date=`${month}-${String(i+1).padStart(2,'0')}`;return {date,number:i+1,available:availability.some(day=>day.date===date&&day.slots.length>0)};})};
}
