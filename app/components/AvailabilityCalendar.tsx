'use client';
import {useEffect,useRef,useState} from 'react';
import {api,ApiError,koreanToday,time} from '../lib/reservations';
import {AvailableDay,monthCells,shiftMonth} from '../lib/availability';

const monthLabel=(month:string)=>`${Number(month.slice(0,4))}년 ${Number(month.slice(5,7))}월`;
const clock=(value:string)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
export function AvailabilityCalendar({passId,trainerId,expiresOn,reservationId,value,onSelect,onSessionExpired,disabled=false,revision=0}:{passId:string|number;trainerId:string|number;expiresOn?:string;reservationId?:number;value:string;onSelect:(startsAt:string)=>void;onSessionExpired:(error:unknown)=>void;disabled?:boolean;revision?:number}) {
  const [month,setMonth]=useState(koreanToday().slice(0,7));
  const [days,setDays]=useState<AvailableDay[]>([]),[selectedDay,setSelectedDay]=useState('');
  const [loading,setLoading]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[loadedKey,setLoadedKey]=useState('');
  const callbacks=useRef({onSelect,onSessionExpired});callbacks.current={onSelect,onSessionExpired};
  const key=`${passId}:${trainerId}:${reservationId??''}:${month}:${revision}:${retry}`;
  const ready=!!passId&&!!trainerId;
  const current=ready&&loadedKey===key;
  useEffect(()=>{
    let active=true;setDays([]);setSelectedDay('');setError('');callbacks.current.onSelect('');
    if(!passId||!trainerId){setLoading(false);return;}
    setLoading(true);
    const query=new URLSearchParams({passId:String(passId),trainerId:String(trainerId),month});if(reservationId)query.set('reservationId',String(reservationId));
    api<{days:AvailableDay[]}>(`member/availability?${query}`).then(result=>{if(active){setDays(result.days);setLoadedKey(key);}}).catch(e=>{if(active){if(e instanceof ApiError&&e.status===401)callbacks.current.onSessionExpired(e);else setError(e instanceof Error?e.message:'예약 가능한 시간을 불러오지 못했어요.');}}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[passId,trainerId,reservationId,month,revision,retry,key]);
  const minimum=koreanToday().slice(0,7),maximum=expiresOn?.slice(0,7);
  const cells=monthCells(month,current?days:[]);
  const slots=current?days.find(day=>day.date===selectedDay)?.slots??[]:[];
  const canSelect=current&&!loading&&!disabled;
  return <section className="availability" aria-label={reservationId?'변경 가능한 일정':'예약 가능한 일정'} aria-busy={loading}>
    <div className="calendar-head"><button type="button" className="secondary small" aria-label="이전 달" disabled={disabled||month<=minimum} onClick={()=>setMonth(shiftMonth(month,-1))}>‹</button><h3 aria-live="polite">{monthLabel(month)}</h3><button type="button" className="secondary small" aria-label="다음 달" disabled={disabled||!!maximum&&month>=maximum} onClick={()=>setMonth(shiftMonth(month,1))}>›</button></div>
    <p className="help">예약 가능한 날짜를 누른 뒤 시간을 선택해 주세요. 모든 시간은 한국 시간이에요.</p>
    <div className="calendar-weekdays" aria-hidden="true">{['일','월','화','수','목','금','토'].map(day=><span key={day}>{day}</span>)}</div>
    <div className="calendar-days" role="group" aria-label={`${monthLabel(month)} 예약 날짜`}>
      {Array.from({length:cells.firstDay},(_,i)=><span key={`blank-${i}`} aria-hidden="true"/>)}
      {cells.days.map(({date:day,number,available:hasSlots})=>{const available=canSelect&&hasSlots;return <button key={day} type="button" disabled={!available} aria-pressed={selectedDay===day} aria-label={`${monthLabel(month)} ${number}일${available?' 예약 가능':' 예약 불가'}`} aria-current={day===koreanToday()?'date':undefined} onClick={()=>{setSelectedDay(day);onSelect('');}}>{number}{available&&<span aria-hidden="true" className="availability-dot"/>}</button>;})}
    </div>
    {loading&&<p className="help" role="status">예약 가능한 시간을 확인하고 있어요…</p>}
    {!ready&&<p className="help">이용권과 트레이너를 먼저 선택해 주세요.</p>}
    {error&&<div className="availability-error"><p className="inline-error" role="alert">{error}</p><button type="button" className="secondary small" onClick={()=>setRetry(n=>n+1)}>다시 불러오기</button></div>}
    {current&&!loading&&!error&&!days.some(day=>day.slots.length)&&<p className="availability-empty" role="status">이 달에는 예약 가능한 시간이 없어요. 다른 달이나 트레이너를 확인해 주세요.</p>}
    {!!selectedDay&&<div className="available-times"><h4>{Number(selectedDay.slice(5,7))}월 {Number(selectedDay.slice(8,10))}일 · 가능한 시간</h4><div className="slot-options" role="group" aria-label="시작 시간">{slots.map(slot=><button key={slot.id} type="button" disabled={!canSelect} className={value===slot.startsAt?'selected':''} aria-pressed={value===slot.startsAt} onClick={()=>onSelect(slot.startsAt)}>{clock(slot.startsAt)} ~ {clock(slot.endsAt)}</button>)}</div></div>}
    {value&&canSelect&&<p className="slot-selection" role="status">선택한 일정: <strong>{time(value)}</strong></p>}
    <p className="help">다른 회원이 먼저 예약하면 선택한 시간이 마감될 수 있어요.</p>
  </section>;
}
