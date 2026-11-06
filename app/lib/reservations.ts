export type Approval = 'pending'|'approved'|'rejected';
export type ReservationStatus = 'booked'|'completed'|'cancelled'|'noshow';
export type PendingChange = {id:number; startsAt:string; requestedAt:string};
export type Reservation = {id:number; passId:number; typeName:string; trainerId:number; trainerName:string; startsAt:string; status:ReservationStatus; approval?:Approval; note:string; pendingChange?:PendingChange|null};
export type HistoryValues = {startsAt?:string; note?:string; status?:ReservationStatus; approval?:Approval};
export type ReservationHistory = {id:number; event:string; actorName:string; actorRole:string; changedAt:string; before:HistoryValues|null; after:HistoryValues|null};
export const statusNames:Record<ReservationStatus,string> = {booked:'예약됨',completed:'운동 완료',cancelled:'취소',noshow:'노쇼'};
export const approvalNames:Record<Approval,string> = {pending:'승인 대기',approved:'승인 완료',rejected:'승인 거절'};
export const eventNames:Record<string,string> = {requested:'일정 변경 요청',approved_change:'일정 변경 승인',rejected_change:'일정 변경 거절',withdrawn:'일정 변경 요청 철회',booked:'예약 접수',approval:'예약 승인 상태 변경',status:'수업 상태 변경',feedback:'PT 피드백 수정'};
export const actorRoleNames:Record<string,string> = {member:'회원',trainer:'트레이너',admin:'마스터 관리자',employee:'부운영자(데스크)'};
export const koreanToday = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
export const date = (value:string) => (value.includes('T')?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date(value)):value.slice(0,10)).replaceAll('-','.');
export const time = (value:string) => new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short',hour:'numeric',minute:'2-digit',hour12:false}).format(new Date(value));
export const auditTime = (value:string) => new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',hour:'numeric',minute:'2-digit',hour12:false}).format(new Date(value));
export function reservationLabel(item:Reservation) {
  if(item.approval==='rejected')return '승인 거절';
  if(item.status==='booked')return item.approval==='pending'?'트레이너 승인 대기':'예약 확정';
  return statusNames[item.status];
}
export function bookingNotice(item:Reservation|undefined) {
  if(item?.approval==='pending')return '예약을 접수했어요. 트레이너 승인 대기 중이에요. 승인 후 예약이 확정돼요.';
  if(item?.approval==='approved')return '예약을 접수했어요. 예약이 확정됐어요.';
  return '예약을 접수했어요. 아래 예약 내역에서 현재 상태를 확인해 주세요.';
}
export class ApiError extends Error {constructor(message:string,public status:number,public path:string){super(message);}}
export async function api<T>(path:string,method='GET',body?:unknown):Promise<T> {
  const response=await fetch(`/api/${path}`,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store'});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new ApiError(result.message||'처리하지 못했어요. 다시 시도해 주세요.',response.status,path);
  return result;
}
