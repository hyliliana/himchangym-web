'use client';
import {useEffect,useRef,useState} from 'react';
import {api,ApiError,actorRoleNames,approvalNames,auditTime,eventNames,Reservation,ReservationHistory,reservationLabel,statusNames,time} from '../lib/reservations';

export function ChangeSummary({reservation}:{reservation:Reservation}) {
  const change=reservation.pendingChange;
  if(!change)return null;
  return <div className="change-summary"><span className="badge info">일정 변경 승인 대기</span><p>현재 일정: <strong>{time(reservation.startsAt)}</strong></p><p>요청 일정: <strong>{time(change.startsAt)}</strong></p><p className="help">요청: {auditTime(change.requestedAt)}<br/>승인 전까지 현재 일정이 유지돼요. 요청 시간은 아직 확보되지 않았어요.</p></div>;
}
function HistoryEntry({entry}:{entry:ReservationHistory}) {
  const before=entry.before??{},after=entry.after??{};
  const fields=Array.from(new Set([...Object.keys(before),...Object.keys(after)]));
  return <li className="history-entry"><div className="history-heading"><strong>{eventNames[entry.event]??'수업 정보 변경'}</strong><time dateTime={entry.changedAt}>{auditTime(entry.changedAt)}</time></div><p className="history-actor">{entry.actorName} · {actorRoleNames[entry.actorRole]??'운영 담당자'}</p>
    {entry.event==='requested'&&<p className="help">변경을 요청했어요. 승인 전까지 기존 예약 일정이 유지돼요.</p>}
    {entry.event==='rejected_change'&&<p className="help">변경 요청이 거절됐어요. 기존 예약 일정이 유지돼요.</p>}
    {entry.event==='withdrawn'&&<p className="help">변경 요청을 철회했어요. 기존 예약 일정이 유지돼요.</p>}
    {fields.includes('startsAt')&&<dl className="history-change"><div><dt>{entry.event==='requested'||entry.event==='rejected_change'||entry.event==='withdrawn'?'기존 일정':'변경 전 일정'}</dt><dd>{before.startsAt?auditTime(before.startsAt):'—'}</dd></div><div><dt>{entry.event==='requested'||entry.event==='rejected_change'||entry.event==='withdrawn'?'요청 일정':'변경 후 일정'}</dt><dd>{after.startsAt?auditTime(after.startsAt):'—'}</dd></div></dl>}
    {fields.includes('status')&&<p className="history-state">수업 상태: {before.status?statusNames[before.status]:'—'} → {after.status?statusNames[after.status]:'—'}</p>}
    {fields.includes('approval')&&<p className="history-state">예약 승인: {before.approval?approvalNames[before.approval]:'—'} → {after.approval?approvalNames[after.approval]:'—'}</p>}
    {fields.includes('note')&&<div className="feedback-diff"><div><strong>이전 피드백</strong><p>{before.note||'작성된 피드백 없음'}</p></div><div><strong>변경한 피드백</strong><p>{after.note||'작성된 피드백 없음'}</p></div></div>}
  </li>;
}
export function ReservationDetail({reservation,onClose,onSessionExpired}:{reservation:Reservation;onClose:()=>void;onSessionExpired:(error:unknown)=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),expired=useRef(onSessionExpired);expired.current=onSessionExpired;
  const [history,setHistory]=useState<ReservationHistory[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  useEffect(()=>{const trigger=document.activeElement,element=dialog.current;element?.showModal();return()=>{element?.close();if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus({preventScroll:true});};},[]);
  useEffect(()=>{let active=true;setLoading(true);setError('');api<{history:ReservationHistory[]}>(`member/reservations/${reservation.id}/history`).then(data=>{if(active)setHistory(data.history.sort((a,b)=>b.changedAt.localeCompare(a.changedAt)||b.id-a.id));}).catch(e=>{if(active){if(e instanceof ApiError&&e.status===401){onClose();expired.current(e);}else setError(e instanceof Error?e.message:'변경 이력을 불러오지 못했어요.');}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[reservation.id,revision]);
  return <dialog ref={dialog} className="dialog lesson-detail-dialog" aria-labelledby="lesson-detail-title" onCancel={event=>{event.preventDefault();onClose();}}><div className="detail-heading"><h2 id="lesson-detail-title">수업 상세</h2><button autoFocus type="button" className="secondary small" onClick={onClose}>닫기</button></div><div className="lesson-summary"><h3>{time(reservation.startsAt)}</h3><p>{reservation.trainerName} 트레이너 · {reservation.typeName}</p><span className="badge info">{reservationLabel(reservation)}</span></div><ChangeSummary reservation={reservation}/><section className="detail-feedback"><h3>현재 PT 피드백</h3><p className="note-body">{reservation.note||'아직 작성된 피드백이 없어요.'}</p></section><section className="lesson-history"><div className="detail-heading"><h3>일정·피드백 변경 이력</h3><button type="button" className="text-button" disabled={loading} onClick={()=>setRevision(n=>n+1)}>다시 불러오기</button></div><p className="help">누가 언제 일정과 피드백을 변경했는지 확인할 수 있어요. 한국 시간 기준이에요.</p>{loading&&<p role="status" className="help">변경 이력을 불러오고 있어요…</p>}{error&&<p role="alert" className="inline-error">{error}</p>}{!loading&&!error&&(history.length?<ol className="history-list">{history.map(entry=><HistoryEntry key={entry.id} entry={entry}/>)}</ol>:<p className="help">저장된 변경 이력이 없어요. 이력 기록 전에 만들어진 예약일 수 있어요.</p>)}</section><button type="button" className="secondary full" onClick={onClose}>닫기</button></dialog>;
}
