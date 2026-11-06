'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

type User = {id:number; email:string; name:string; kind:string; mustChangePassword:boolean};
type NotificationPreferences = {kakao:boolean; sms:boolean; updatedAt:string|null};
type Pass = {id:number; typeName:string; purchasedOn:string; paidAmount:number; expiresOn:string; totalSessions:number; usedSessions:number; bookedSessions:number; remainingSessions:number; availableSessions:number; isUsable:boolean};
type Reservation = {id:number; passId:number; typeName:string; trainerId:number; trainerName:string; startsAt:string; status:'booked'|'completed'|'cancelled'|'noshow'; approval?:'pending'|'approved'|'rejected'; note:string};
type Trainer = {id:number; name:string; workingDays:number[]};
type Receipt = {id:number; fileName:string; mimeType:string; dataUrl:string; createdAt:string};
type Dashboard = {member:{id:number; name:string; phone:string; joinedAt:string}; passes:Pass[]; reservations:Reservation[]};
type Tab = 'passes'|'reservations'|'notes'|'profile';
const weekdays = ['일','월','화','수','목','금','토'];
const statusNames = {booked:'예약됨', completed:'운동 완료', cancelled:'취소', noshow:'노쇼'};
function reservationLabel(item:Reservation) {
  if(item.approval==='rejected')return '승인 거절';
  if(item.status==='booked')return item.approval==='pending'?'트레이너 승인 대기':'예약 승인 완료';
  return statusNames[item.status];
}
function ReservationBadge({item}:{item:Reservation}) {
  const tone=item.approval==='rejected'||item.status==='noshow'?'negative':item.status==='cancelled'?'muted':item.approval==='pending'?'info':'positive';
  return <span className={`badge ${tone}`}>{reservationLabel(item)}</span>;
}
function bookingNotice(item:Reservation|undefined,changed=false) {
  const action=changed?'예약 시간을 변경했어요.':'예약을 접수했어요.';
  if(item?.approval==='pending')return `${action} 트레이너 승인 대기 중이에요. 승인 후 예약이 확정돼요.`;
  if(item?.approval==='approved')return `${action} 예약 승인이 완료됐어요.`;
  if(item?.approval==='rejected')return `${action} 승인 거절 상태예요. 예약 내역을 확인해 주세요.`;
  return `${action} 아래 예약 내역에서 현재 상태를 확인해 주세요.`;
}
const koreanToday = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul'}).format(new Date());
const date = (value:string) => (value.includes('T') ? new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date(value)) : value.slice(0,10)).replaceAll('-', '.');
const time = (value:string) => new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul', month:'long', day:'numeric', weekday:'short', hour:'numeric', minute:'2-digit', hour12:false}).format(new Date(value));
class ApiError extends Error { constructor(message:string, public status:number, public path:string){super(message);} }
async function api<T>(path:string, method='GET', body?:unknown):Promise<T> {
  const response = await fetch(`/api/${path}`, {method, credentials:'same-origin', headers:{'Content-Type':'application/json'}, ...(body === undefined ? {} : {body:JSON.stringify(body)})});
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(result.message || '처리하지 못했어요. 다시 시도해 주세요.', response.status, path);
  return result;
}
type IconName = 'dumbbell' | 'ticket' | 'calendar' | 'record' | 'user' | 'receipt';
function Icon({name}: {name:IconName}) {
  const paths:Record<IconName,React.ReactNode> = {
    dumbbell: <><path d="m6.5 6.5 11 11M5 3 3 5l3 3-2 2 10 10 2-2 3 3 2-2-3-3 2-2L10 4 8 6 5 3Z"/><path d="m3 10 7-7m4 18 7-7"/></>,
    ticket: <><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7Z"/><path d="M15 5v2m0 4v2m0 4v2"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 5 2 2 4-4"/></>,
    record: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 11h6m-6 4h6"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/></>,
    receipt: <><path d="M6 3 4 5v16l4-2 4 2 4-2 4 2V5l-2-2-2 2-2-2-2 2-2-2-2 2-2-2Z"/><path d="M8 9h8m-8 4h8m-8 4h4"/></>,
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
function Field({label, children, help}: {label:string; children:React.ReactNode; help?:string}) {
  return <label className="field"><span>{label}</span>{children}{help && <small>{help}</small>}</label>;
}
function Empty({title, children}:{title:string; children:React.ReactNode}) {
  return <div className="empty"><Icon name="dumbbell"/><h3>{title}</h3><p>{children}</p></div>;
}
function CancelDialog({reservation,busy,onCancel,onKeep}:{reservation:Reservation;busy:boolean;onCancel:()=>void;onKeep:()=>void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(()=>{const element=dialog.current;const trigger=document.activeElement;element?.showModal();return ()=>{element?.close();if(trigger instanceof HTMLElement && trigger.isConnected)trigger.focus({preventScroll:true});};},[]);
  return <dialog ref={dialog} className="dialog" aria-labelledby="cancel-title" aria-describedby="cancel-description" aria-busy={busy} onCancel={event=>{event.preventDefault();if(!busy)onKeep();}}><h2 id="cancel-title">예약을 취소할까요?</h2><p id="cancel-description">{time(reservation.startsAt)}<br/>{reservation.trainerName} 트레이너<br/><br/>취소해도 이용권 횟수는 차감되지 않아요.</p><button className="primary full" disabled={busy} onClick={onCancel}>{busy?'취소하고 있어요…':'예약 취소하기'}</button><button autoFocus className="secondary full" disabled={busy} onClick={onKeep}>예약 유지하기</button></dialog>;
}
function RescheduleDialog({reservation,trainer,pass,onClose,onChanged,onSessionExpired}:{reservation:Reservation;trainer?:Trainer;pass?:Pass;onClose:()=>void;onChanged:(reservation?:Reservation)=>Promise<void>;onSessionExpired:(error:unknown)=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [day,setDay]=useState(date(reservation.startsAt).replaceAll('.','-'));
  const [hour,setHour]=useState(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',hourCycle:'h23'}).format(new Date(reservation.startsAt)));
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const off=!!trainer&&!trainer.workingDays.includes(new Date(`${day}T12:00:00+09:00`).getUTCDay());
  const unchanged=new Date(`${day}T${hour}:00:00+09:00`).getTime()===new Date(reservation.startsAt).getTime();
  useEffect(()=>{const el=dialog.current;const trigger=document.activeElement;el?.showModal();return()=>{el?.close();if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus({preventScroll:true});};},[]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(saving)return;setSaving(true);setError('');
    try{const result=await api<{reservation?:Reservation}>(`member/reservations/${reservation.id}/reschedule`,'POST',{startsAt:`${day}T${hour}:00:00+09:00`});await onChanged(result.reservation);}
    catch(error){if(error instanceof ApiError&&error.status===401){onClose();onSessionExpired(error);}else setError(error instanceof Error?error.message:'시간을 변경하지 못했어요. 기존 예약은 유지됩니다.');}
    finally{setSaving(false);}
  }
  return <dialog ref={dialog} className="dialog reschedule-dialog" aria-labelledby="reschedule-title" aria-busy={saving} onCancel={event=>{event.preventDefault();if(!saving)onClose();}}>
    <h2 id="reschedule-title">예약 시간 변경</h2><p>{reservation.trainerName} 트레이너 · {reservation.typeName}<br/>현재 예약: {time(reservation.startsAt)}</p>
    <form className="form" onSubmit={submit}>
      <div className="form-grid"><Field label="변경할 날짜"><input type="date" required value={day} disabled={saving} min={koreanToday()} max={pass?.expiresOn} onChange={event=>{setDay(event.target.value);setError('');}}/></Field><Field label="변경할 시작 시간"><select required value={hour} disabled={saving} onChange={event=>{setHour(event.target.value);setError('');}}>{Array.from({length:24},(_,n)=><option key={n} value={String(n).padStart(2,'0')}>{String(n).padStart(2,'0')}:00 ~ {String((n+1)%24).padStart(2,'0')}:00</option>)}</select></Field></div>
      {trainer&&<p className="help">근무 요일: {trainer.workingDays.map(n=>weekdays[n]).join('·')}</p>}
      {off&&<p className="inline-error" role="status">선택한 날짜는 트레이너의 휴무일이에요.</p>}
      {error&&<div className="message error" role="alert">{error}</div>}
      <p className="help">시간 변경 시 트레이너의 재승인이 필요할 수 있어요. 변경 후 승인 상태를 확인해 주세요. 이용권 횟수는 추가로 차감되지 않아요.</p>
      <div className="dialog-actions"><button autoFocus type="button" className="secondary" disabled={saving} onClick={onClose}>돌아가기</button><button type="submit" className="primary" disabled={saving||off||unchanged}>{saving?'변경하고 있어요…':'시간 변경'}</button></div>
    </form>
  </dialog>;
}
function NotificationSettings({onSessionExpired}:{onSessionExpired:(error:unknown)=>void}) {
  const [preferences,setPreferences]=useState<NotificationPreferences|null>(null);
  const [kakao,setKakao]=useState(false),[sms,setSms]=useState(false);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [revision,setRevision]=useState(0);
  useEffect(()=>{let active=true;setLoading(true);setError('');api<{preferences:NotificationPreferences}>('member/notification-preferences').then(({preferences:p})=>{if(active){setPreferences(p);setKakao(p.kakao);setSms(p.sms);}}).catch(e=>{if(active){if(e instanceof ApiError&&e.status===401)onSessionExpired(e);else setError(e instanceof Error?e.message:'수신 설정을 불러오지 못했어요.');}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[revision]);
  async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();if(saving||loading||!preferences)return;setSaving(true);setError('');setNotice('');try{const result=await api<{preferences:NotificationPreferences}>('member/notification-preferences','PATCH',{kakao,sms});setPreferences(result.preferences);setNotice('수신 설정을 저장했어요. 언제든 변경할 수 있어요.');}catch(e){if(e instanceof ApiError&&e.status===401)onSessionExpired(e);else setError(e instanceof Error?e.message:'설정을 저장하지 못했어요.');}finally{setSaving(false);}}
  return <section className="card"><h2>알림 수신 설정</h2><p className="section-copy">PT 피드백과 예약 안내를 받을 방법을 선택해 주세요.</p><p className="help">현재 카카오톡·문자 발송은 연결 준비 중이에요. 지금은 수신 설정만 저장되며 실제 알림은 발송되지 않아요.</p>{loading&&<p className="help" role="status">수신 설정을 불러오고 있어요…</p>}{error&&<div className="message error" role="alert">{error}</div>}{notice&&<div className="message success" role="status">{notice}</div>}{!loading&&!preferences?<button className="secondary full" onClick={()=>setRevision(n=>n+1)}>다시 불러오기</button>:<form className="form" onSubmit={save}><label className="preference"><input type="checkbox" checked={kakao} disabled={loading||saving} onChange={e=>{setKakao(e.target.checked);setNotice('');}}/><span>카카오톡으로 PT 피드백·예약 안내 받기 <small>(선택)</small></span></label><label className="preference"><input type="checkbox" checked={sms} disabled={loading||saving} onChange={e=>{setSms(e.target.checked);setNotice('');}}/><span>문자로 PT 피드백·예약 안내 받기 <small>(선택)</small></span></label><p className="help">선택하지 않아도 힘찬짐을 이용할 수 있어요. 광고·이벤트 수신 동의와는 별개예요.</p><button className="secondary full" disabled={loading||saving||!preferences}>{saving?'저장하고 있어요…':'수신 설정 저장'}</button>{preferences?.updatedAt&&<p className="help">마지막 변경: {time(preferences.updatedAt)}</p>}</form>}</section>;
}
function ReceiptImage({receipt}:{receipt:Receipt}) {
  const [enlarged,setEnlarged] = useState(false);
  const [failed,setFailed] = useState(false);
  const safeImage = /^data:image\/(png|jpeg|webp);base64,/.test(receipt.dataUrl);
  return <figure className="receipt-figure"><figcaption><strong>{receipt.fileName}</strong><span className="subtle">{date(receipt.createdAt)} 등록</span></figcaption>{failed || !safeImage ? <p className="inline-error">영수증 이미지를 표시하지 못했어요. 데스크에 문의해 주세요.</p> : <><button className="text-button" aria-pressed={enlarged} onClick={()=>setEnlarged(!enlarged)}>{enlarged?'화면에 맞추기':'크게 보기'}</button><div className={`receipt-image-scroll ${enlarged?'enlarged':''}`} tabIndex={0} role="region" aria-label={`${receipt.fileName} 영수증 이미지${enlarged?', 스크롤해서 전체 보기':''}`}><img src={receipt.dataUrl} alt={`${receipt.fileName} 영수증`} onError={()=>setFailed(true)}/></div>{enlarged && <small className="subtle">좌우·위아래로 스크롤하면 영수증 전체를 볼 수 있어요.</small>}</>}</figure>;
}
function ReceiptDialog({receipts,passName,onClose,triggerRef}:{receipts:Receipt[];passName:string;onClose:()=>void;triggerRef:React.RefObject<HTMLButtonElement|null>}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(()=>{const element=dialog.current;const trigger=triggerRef.current;element?.showModal();return ()=>{element?.close();if(trigger?.isConnected)trigger.focus({preventScroll:true});};},[triggerRef]);
  return <dialog ref={dialog} className="dialog receipt-dialog" aria-labelledby="receipt-title" onCancel={event=>{event.preventDefault();onClose();}}><div className="receipt-dialog-heading"><div><h2 id="receipt-title" className="icon-label"><Icon name="receipt"/>구매 영수증</h2><p>{passName}</p></div><button autoFocus type="button" className="secondary small" aria-label="영수증 닫기" onClick={onClose}>닫기</button></div>{receipts.length ? receipts.map(receipt=><ReceiptImage key={receipt.id} receipt={receipt}/>) : <Empty title="등록된 영수증이 없어요">직원이 영수증을 등록하면 이곳에서 확인하실 수 있어요. 등록이 필요하면 데스크에 문의해 주세요.</Empty>}<button className="secondary full" onClick={onClose}>닫기</button></dialog>;
}
function PassCard({pass, onBook, historical=false}:{pass:Pass; onBook:(id:number)=>void; historical?:boolean}) {
  const receiptTrigger = useRef<HTMLButtonElement>(null);
  const [receipts,setReceipts] = useState<Receipt[]|null>(null);
  const [receiptLoading,setReceiptLoading] = useState(false);
  const [receiptError,setReceiptError] = useState('');
  async function showReceipts() {
    setReceiptLoading(true);setReceiptError('');
    try {const result=await api<{receipts:Receipt[]}>(`member/passes/${pass.id}/receipts`);setReceipts(result.receipts);} catch(error){setReceiptError(error instanceof Error?error.message:'영수증을 불러오지 못했어요. 다시 시도해 주세요.');} finally {setReceiptLoading(false);}
  }
  return <article className="card pass-card">
    <div className="row"><h3 className="icon-label"><Icon name="ticket"/>{pass.typeName}</h3><span className={`badge ${historical ? 'muted' : 'positive'}`}>{historical ? (pass.expiresOn < koreanToday() ? '기간 만료' : '모두 사용') : '이용 중'}</span></div>
    <div className="pass-count"><strong>{pass.remainingSessions}<span>회</span></strong><span>남았어요 <span className="subtle">/ 총 {pass.totalSessions}회</span></span></div>
    <dl className="pass-details"><div><dt>예약 확보</dt><dd>{pass.bookedSessions}회</dd></div><div><dt>새로 예약 가능</dt><dd>{historical ? 0 : pass.availableSessions}회</dd></div><div><dt>이용 기간</dt><dd>{date(pass.purchasedOn)} ~ {date(pass.expiresOn)}</dd></div></dl>
    {!historical && <><p className="help">예약한 횟수는 확보되며, 운동 완료·노쇼일 때 사용 횟수에서 차감돼요.</p><button className="secondary full" onClick={()=>onBook(pass.id)} disabled={!pass.isUsable || pass.availableSessions < 1}>{pass.availableSessions > 0 && pass.isUsable ? '이 이용권으로 예약하기' : '예약 가능 횟수를 모두 확보했어요'}</button></>}
    <details className="purchase"><summary>구매 내역</summary><dl className="pass-details"><div><dt>결제 금액</dt><dd>{pass.paidAmount.toLocaleString()}원</dd></div><div><dt>사용 횟수</dt><dd>{pass.usedSessions}회</dd></div></dl><button ref={receiptTrigger} type="button" className="secondary full receipt-open" disabled={receiptLoading} onClick={showReceipts}><Icon name="receipt"/> {receiptLoading?'영수증을 불러오는 중…':'영수증 보기'}</button>{receiptError && <p className="inline-error receipt-error" role="alert">{receiptError}</p>}</details>
    {receipts !== null && <ReceiptDialog receipts={receipts} passName={pass.typeName} onClose={()=>setReceipts(null)} triggerRef={receiptTrigger}/>}
  </article>;
}

export default function Home() {
  const [user,setUser] = useState<User|null>(null);
  const [booting,setBooting] = useState(true);
  const [authMode,setAuthMode] = useState<'login'|'signup'>('login');
  const [tab,setTab] = useState<Tab>('passes');
  const [dashboard,setDashboard] = useState<Dashboard|null>(null);
  const [trainers,setTrainers] = useState<Trainer[]>([]);
  const [loading,setLoading] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [history,setHistory] = useState(false);
  const [selectedPass,setSelectedPass] = useState('');
  const [selectedTrainer,setSelectedTrainer] = useState('');
  const [bookingDate,setBookingDate] = useState(koreanToday());
  const [cancelTarget,setCancelTarget] = useState<Reservation|null>(null);
  const [rescheduleTarget,setRescheduleTarget] = useState<Reservation|null>(null);

  function report(error:unknown) {
    setError(error instanceof Error ? error.message : '처리하지 못했어요. 다시 시도해 주세요.');
    if(error instanceof ApiError && error.status === 401 && error.path !== 'auth/change-password') {setUser(null);setDashboard(null);}
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function inform(message:string){setNotice(message);window.scrollTo({top:0,behavior:'smooth'});}
  async function refresh() {
    setLoading(true);
    try {
      const [data,catalog] = await Promise.all([api<Dashboard>('member/dashboard'), api<{trainers:Trainer[]}>('catalog')]);
      setDashboard(data);setTrainers(catalog.trainers);
      setSelectedPass(previous => data.passes.some(pass=>String(pass.id)===previous && pass.isUsable && pass.availableSessions>0) ? previous : String(data.passes.find(pass => pass.isUsable && pass.availableSessions > 0)?.id || ''));
      setSelectedTrainer(previous => catalog.trainers.some(trainer=>String(trainer.id)===previous) ? previous : String(catalog.trainers[0]?.id || ''));
    } catch(error) {report(error);} finally {setLoading(false);}
  }
  useEffect(()=>{
    api<{user:User}>('auth/me').then(result=>setUser(result.user)).catch(error=>{
      if (!(error instanceof ApiError && error.status === 401)) setError(error instanceof Error ? error.message : '서비스에 연결하지 못했어요.');
    }).finally(()=>setBooting(false));
  },[]);
  useEffect(()=>{if(user&&!user.mustChangePassword) void refresh();else setDashboard(null);},[user?.id,user?.mustChangePassword]); // Fetch member data only after the initial password change.
  function move(next:Tab) {setTab(next);setError('');setNotice('');}
  function bookWith(id:number) {setSelectedPass(String(id));move('reservations');window.scrollTo({top:0,behavior:'smooth'});}
  async function authenticate(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');setNotice('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {const result = await api<{user:User}>(`auth/${authMode}`, 'POST', values);setUser(result.user);setTab('passes');setNotice(authMode === 'signup' ? '가입을 마쳤어요. 이용권 등록은 데스크에 문의해 주세요.' : '반가워요. 오늘도 힘찬 운동 하세요.');} catch(error){report(error);} finally {setBusy(false);}
  }
  async function logout() {
    setBusy(true);setError('');
    try {await api('auth/logout','POST',{});setUser(null);setDashboard(null);setNotice('로그아웃했어요.');setSelectedPass('');setSelectedTrainer('');}catch(error){report(error);}finally{setBusy(false);}
  }
  async function reserve(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');setNotice('');
    const form = new FormData(event.currentTarget);
    try {
      const result=await api<{reservation?:Reservation}>('member/reservations','POST',{passId:Number(selectedPass),trainerId:Number(selectedTrainer),startsAt:`${bookingDate}T${form.get('hour')}:00:00+09:00`});
      inform(bookingNotice(result.reservation));await refresh();
    }catch(error){report(error);}finally{setBusy(false);}
  }
  async function cancel() {
    if(!cancelTarget)return;setBusy(true);setError('');setNotice('');
    try {await api(`member/reservations/${cancelTarget.id}/cancel`,'POST',{});setCancelTarget(null);inform('예약을 취소했어요. 이용권 횟수는 차감되지 않아요.');await refresh();}catch(error){setCancelTarget(null);report(error);}finally{setBusy(false);}
  }
  async function saveProfile(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');setNotice('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {await api('member/profile','PATCH',values);setUser(previous=>previous ? {...previous,name:String(values.name)} : previous);inform('회원 정보를 저장했어요.');await refresh();}catch(error){report(error);}finally{setBusy(false);}
  }
  async function savePassword(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const form = event.currentTarget;setBusy(true);setError('');setNotice('');
    const values = Object.fromEntries(new FormData(form));
    if(values.newPassword !== values.confirmPassword){report(new Error('새 비밀번호가 서로 달라요. 다시 확인해 주세요.'));setBusy(false);return;}
    try {const result=await api<{user:User}>('auth/change-password','POST',{currentPassword:values.currentPassword,newPassword:values.newPassword});form.reset();setUser(result.user);inform('비밀번호를 변경했어요.');}catch(error){report(error);}finally{setBusy(false);}
  }
  const activePasses = dashboard?.passes.filter(pass=>pass.expiresOn >= koreanToday() && pass.remainingSessions > 0) || [];
  const oldPasses = dashboard?.passes.filter(pass=>pass.expiresOn < koreanToday() || pass.remainingSessions <= 0) || [];
  const availablePasses = dashboard?.passes.filter(pass=>pass.isUsable && pass.availableSessions > 0) || [];
  const booked = dashboard?.reservations.filter(item=>item.status === 'booked').sort((a,b)=>a.startsAt.localeCompare(b.startsAt)) || [];
  const nextBooking = booked.find(item=>new Date(item.startsAt)>new Date());
  const past = dashboard?.reservations.filter(item=>item.status !== 'booked').sort((a,b)=>b.startsAt.localeCompare(a.startsAt)) || [];
  const notes = dashboard?.reservations.filter(item=>item.note?.trim()).sort((a,b)=>b.startsAt.localeCompare(a.startsAt)) || [];
  const trainer = trainers.find(item=>String(item.id)===selectedTrainer);
  const selectedDay = new Date(`${bookingDate}T12:00:00+09:00`).getUTCDay();
  const trainerOff = !!trainer && !trainer.workingDays.includes(selectedDay);

  if(booting) return <main className="auth-shell"><p role="status">내 운동 정보를 불러오고 있어요.</p></main>;
  return <>
    <a className="skip" href="#main">본문으로 이동</a>
    <header className="top"><div className="top-inner"><a className="brand" href="/"><img className="brand-symbol" src="/brand/himchangym-symbol.svg" width="32" height="32" alt=""/>힘찬짐<span>내 운동</span></a>{user && <button className="text-button" disabled={busy} onClick={logout}>로그아웃</button>}</div></header>
    {!user ? <main id="main" className="auth-shell">
      <div className="auth-heading"><p className="eyebrow"><Icon name="dumbbell"/>힘찬짐 회원 서비스</p><h1>{authMode === 'login' ? '내 운동을 이어가세요' : '힘찬 시작, 함께해요'}</h1><p>이용권을 확인하고 원하는 시간에 예약하세요.</p></div>
      <div className="card auth-card"><div className="segments" aria-label="계정 메뉴"><button type="button" className={authMode === 'login'?'selected':''} onClick={()=>{setAuthMode('login');setError('');}}>로그인</button><button type="button" className={authMode === 'signup'?'selected':''} onClick={()=>{setAuthMode('signup');setError('');}}>회원가입</button></div>
        {error && <div className="message error" role="alert">{error}</div>}{notice && <div className="message success" role="status">{notice}</div>}
        <form onSubmit={authenticate} className="form" key={authMode}>
          {authMode === 'signup' && <><Field label="이름"><input name="name" autoComplete="name" required minLength={2} maxLength={50} placeholder="이름을 입력해 주세요"/></Field><Field label="연락처"><input name="phone" type="tel" autoComplete="tel" required maxLength={20} placeholder="010-1234-5678"/></Field></>}
          <Field label="이메일"><input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="example@email.com"/></Field>
          <Field label="비밀번호" help={authMode === 'signup'?'8자 이상으로 입력해 주세요.':undefined}><input name="password" type="password" autoComplete={authMode === 'signup'?'new-password':'current-password'} required minLength={authMode === 'signup'?8:1} maxLength={128} placeholder="비밀번호를 입력해 주세요"/></Field>
          <button className="primary full" disabled={busy}>{busy ? '처리하고 있어요…' : authMode === 'login'?'로그인':'가입하기'}</button>
        </form><p className="help auth-help">{authMode === 'signup' ? '가입 후 이용권 구매·등록은 힘찬짐 데스크에서 도와드려요.' : '로그인이 어려우시면 힘찬짐 데스크에 문의해 주세요.'}</p>
      </div><p className="footer-note">힘찬짐 · 회원 전용</p>
    </main> : user.mustChangePassword ? <main id="main" className="auth-shell"><div className="auth-heading"><h1>내 비밀번호를 설정해 주세요</h1><p>데스크에서 받은 임시 비밀번호를 바꾸면 회원 서비스를 이용할 수 있어요.</p></div><section className="card auth-card">{error&&<div className="message error" role="alert">{error}</div>}<form className="form" onSubmit={savePassword}><Field label="임시 비밀번호"><input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128}/></Field><Field label="새 비밀번호" help="8자 이상으로 입력해 주세요."><input name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128}/></Field><Field label="새 비밀번호 확인"><input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128}/></Field><button className="primary full" disabled={busy}>{busy?'변경하고 있어요…':'비밀번호 설정하고 시작하기'}</button></form></section></main> : <>
      <nav className="navigation" aria-label="회원 메뉴"><div>{([['passes','내 이용권'],['reservations','예약 관리'],['notes','PT 피드백'],['profile','내 정보']] as [Tab,string][]).map(([key,label])=><button key={key} className={tab===key?'active':''} aria-current={tab===key?'page':undefined} onClick={()=>move(key)}><span className="nav-label"><Icon name={({passes:'ticket',reservations:'calendar',notes:'record',profile:'user'} as const)[key]}/>{label}</span></button>)}</div></nav>
      <main id="main" className="content"><div className="page-heading"><div><p className="eyebrow">{dashboard?.member.name || user.name}님의 힘찬 하루</p><h1>{{passes:'내 이용권',reservations:'예약 관리',notes:'PT 피드백',profile:'내 정보'}[tab]}</h1></div><button className="text-button" disabled={loading || busy} onClick={()=>{setError('');void refresh();}}>{loading?'불러오는 중…':'새로고침'}</button></div>
      {error && <div className="message error" role="alert">{error}</div>}{notice && <div className="message success" role="status">{notice}</div>}
      {loading && !dashboard && <div className="card" role="status">내 운동 정보를 불러오고 있어요.</div>}
      {!dashboard && !loading && <div className="card"><Empty title="운동 정보를 불러오지 못했어요">위의 새로고침을 눌러 다시 연결해 주세요.</Empty></div>}
      {dashboard && <>
        {tab==='passes' && <>
          {nextBooking && <button className="next-booking" onClick={()=>move('reservations')}><span><span className="eyebrow">다가오는 예약 · {reservationLabel(nextBooking)}</span><strong>{time(nextBooking.startsAt)}</strong><span>{nextBooking.trainerName} 트레이너</span></span><span aria-hidden="true">→</span></button>}
          <div className="section-head"><h2>{history?'지난 이용권':'현재 이용권'} <span className="subtle">{history?oldPasses.length:activePasses.length}</span></h2><button className="text-button" onClick={()=>setHistory(!history)}>{history?'현재 이용권 보기':'지난 이용권 보기'}</button></div>
          {(history?oldPasses:activePasses).length ? <div className="stack">{(history?oldPasses:activePasses).map(pass=><PassCard key={pass.id} pass={pass} onBook={bookWith} historical={history}/>)}</div> : <div className="card"><Empty title={history?'지난 이용권이 없어요':'이용 중인 이용권이 없어요'}>{history?'운동을 마친 이용권과 만료된 이용권이 여기에 표시돼요.':'새 이용권 구매·등록은 힘찬짐 데스크에 문의해 주세요.'}</Empty>{!history && <p className="help center">등록이 완료되면 이 화면에서 횟수와 기간을 확인할 수 있어요.</p>}</div>}
        </>}
        {tab==='reservations' && <>
          <section className="card"><h2 className="icon-label"><Icon name="calendar"/>운동 예약하기</h2><p className="section-copy">1시간 단위로 예약할 수 있어요. 모든 시간은 한국 시간이에요. 트레이너 승인이 필요한 예약은 승인 후 확정돼요.</p>
          {!availablePasses.length ? <Empty title="지금 예약할 수 있는 이용권이 없어요">이용권이 없다면 데스크에 문의해 주세요. 이미 예약한 횟수는 아래에서 확인할 수 있어요.</Empty> : <form onSubmit={reserve} className="form booking-form">
            <Field label="사용할 이용권"><select value={selectedPass} onChange={event=>setSelectedPass(event.target.value)} required><option value="" disabled>이용권을 선택해 주세요</option>{availablePasses.map(pass=><option key={pass.id} value={pass.id}>{pass.typeName} · 새로 예약 가능 {pass.availableSessions}회 · {date(pass.expiresOn)}까지</option>)}</select></Field>
            <Field label="트레이너" help={trainer ? `근무 요일: ${trainer.workingDays.map(day=>weekdays[day]).join('·')}`:undefined}><select value={selectedTrainer} onChange={event=>setSelectedTrainer(event.target.value)} required><option value="" disabled>트레이너를 선택해 주세요</option>{trainers.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            <div className="form-grid"><Field label="예약 날짜"><input type="date" value={bookingDate} onChange={event=>setBookingDate(event.target.value)} required min={koreanToday()} max={availablePasses.find(pass=>String(pass.id)===selectedPass)?.expiresOn}/></Field><Field label="시작 시간"><select name="hour" defaultValue="10" required>{Array.from({length:24},(_,hour)=><option key={hour} value={String(hour).padStart(2,'0')}>{String(hour).padStart(2,'0')}:00 ~ {String((hour+1)%24).padStart(2,'0')}:00</option>)}</select></Field></div>
            {trainerOff && <p className="inline-error" role="status">선택한 날짜는 {trainer?.name} 트레이너의 휴무일이에요. 날짜나 트레이너를 변경해 주세요.</p>}
            <p className="help">예약 취소는 횟수를 차감하지 않아요. 운동 완료·노쇼는 각각 1회 차감돼요.</p><button className="primary full" disabled={busy || trainerOff || !selectedPass || !selectedTrainer}>{busy?'예약하고 있어요…':'예약하기'}</button>
          </form>}</section>
          <section className="card"><div className="section-head"><h2>예정된 예약 <span className="subtle">{booked.length}</span></h2></div>{booked.length ? <div className="reservation-list">{booked.map(item=><article className="reservation" key={item.id}><div><div className="row reservation-title"><h3>{time(item.startsAt)}</h3><ReservationBadge item={item}/></div><p>{item.trainerName} 트레이너 · {item.typeName}</p>{item.approval==='pending'&&<p className="help">트레이너가 확인 중이에요. 승인 후 예약이 확정돼요.</p>}{item.note && <><p className="note-preview">{item.note}</p><button className="text-button" onClick={()=>move('notes')}>PT 피드백 보기</button></>}{new Date(item.startsAt)<=new Date() && <p>시작된 예약의 변경은 데스크에 문의해 주세요.</p>}</div><div className="reservation-actions"><button className="secondary small" onClick={()=>setRescheduleTarget(item)} disabled={busy || new Date(item.startsAt)<=new Date()}>시간 변경</button><button className="secondary small" onClick={()=>setCancelTarget(item)} disabled={busy || new Date(item.startsAt)<=new Date()}>{new Date(item.startsAt)<=new Date()?'데스크 문의':'예약 취소'}</button></div></article>)}</div>:<Empty title="예약된 운동이 없어요">위에서 원하는 트레이너와 시간을 선택해 주세요.</Empty>}</section>
          <section className="card"><h2>지난 예약</h2>{past.length ? <div className="reservation-list">{past.map(item=><article className="reservation" key={item.id}><div><h3>{time(item.startsAt)}</h3><p>{item.trainerName} 트레이너 · {item.typeName}</p>{item.approval==='rejected'&&<p className="help">예약이 취소됐으며 이용권 횟수는 차감되지 않아요. 다른 시간을 선택해 주세요.</p>}{item.note&&<><p className="note-preview">{item.note}</p><button className="text-button" onClick={()=>move('notes')}>PT 피드백 보기</button></>}</div><ReservationBadge item={item}/></article>)}</div>:<Empty title="지난 예약이 없어요">완료·취소·노쇼 내역이 여기에 표시돼요.</Empty>}</section>
        </>}
        {tab==='notes' && <section className="card"><h2 className="icon-label"><Icon name="record"/>트레이너의 코칭</h2><p className="section-copy">오늘 배운 자세와 다음 운동에서 신경 쓸 점을 확인해 보세요.</p>{notes.length ? <div className="notes-list">{notes.map(item=><article className="exercise-note" key={item.id}><div className="row"><h3>{time(item.startsAt)}</h3><ReservationBadge item={item}/></div><p className="subtle">{item.trainerName} 트레이너 · {item.typeName}</p><p className="note-body">{item.note}</p></article>)}</div>:<Empty title="아직 PT 피드백이 없어요">수업 후 트레이너가 남긴 피드백을 여기에서 확인할 수 있어요.</Empty>}</section>}
        {tab==='profile' && <>
          <section className="card"><h2 className="icon-label"><Icon name="user"/>회원 정보</h2><form className="form" onSubmit={saveProfile} key={`${dashboard.member.name}-${dashboard.member.phone}`}><Field label="이름"><input name="name" required minLength={2} maxLength={50} defaultValue={dashboard.member.name} autoComplete="name"/></Field><Field label="연락처"><input name="phone" type="tel" required maxLength={20} defaultValue={dashboard.member.phone} autoComplete="tel"/></Field><Field label="이메일"><input value={user.email} readOnly className="readonly"/></Field><dl className="pass-details"><div><dt>가입일</dt><dd>{date(dashboard.member.joinedAt)}</dd></div></dl><button className="primary full" disabled={busy}>{busy?'저장하고 있어요…':'회원 정보 저장/수정'}</button></form></section>
          <NotificationSettings onSessionExpired={report}/><section className="card"><h2>비밀번호 변경</h2><form className="form" onSubmit={savePassword}><Field label="현재 비밀번호"><input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128}/></Field><Field label="새 비밀번호" help="8자 이상으로 입력해 주세요."><input name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128}/></Field><Field label="새 비밀번호 확인"><input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128}/></Field><button className="secondary full" disabled={busy}>{busy?'변경하고 있어요…':'비밀번호 변경'}</button></form></section>
        </>}
      </>}
      <p className="footer-note">이용권·예약 문의는 힘찬짐 데스크로 연락해 주세요.</p></main>
    </>}
    {rescheduleTarget && user && !user.mustChangePassword && <RescheduleDialog reservation={rescheduleTarget} trainer={trainers.find(t=>t.id===rescheduleTarget.trainerId)} pass={dashboard?.passes.find(p=>p.id===rescheduleTarget.passId)} onClose={()=>setRescheduleTarget(null)} onSessionExpired={report} onChanged={async reservation=>{setRescheduleTarget(null);inform(bookingNotice(reservation,true));await refresh();}}/>}
    {cancelTarget && <CancelDialog reservation={cancelTarget} busy={busy} onCancel={cancel} onKeep={()=>setCancelTarget(null)}/>}
  </>;
}
