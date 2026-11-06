# Shared API contract — camelCase JSON

Backend base no prefix, localhost :4100. `message` string on errors. IDs numeric. Status values `booked|completed|cancelled|noshow`. Dates YYYY-MM-DD; reservation startsAt is ISO timestamp WITH timezone (KST +09:00). All business date/month logic Asia/Seoul. Money KRW integers.

## Auth
- POST /auth/signup {email,password,name,phone} -> {token,user}; creates member only.
- POST /auth/login {email,password,kind:'member'|'staff'} -> {token,user}
- GET /auth/me -> {user}
- POST /auth/logout -> {ok:true}
- POST /auth/change-password {currentPassword,newPassword} -> {ok:true,user}
- user = {id,email,name,kind:'member'|'staff',role:'admin'|'employee'|null,mustChangePassword:boolean}
- Auth header `Authorization: Bearer TOKEN`. Disabled users rejected on every request. mustChangePassword users can access only me/change-password/logout.
- Frontends implement same-origin /api/[...path] proxy using BACKEND_URL; read/write `gym_session` HttpOnly SameSite=Lax cookie, Secure in production. On signup/login store token cookie and return only user. Forward cookie token as Bearer. Strip cookie/token from errors/logs. No client-visible secrets. Frontend functions fetch `/api/...`.

## Shared catalog
GET /catalog -> {trainers:[{id,name,workingDays:number[]}],passTypes:[{id,name,totalSessions,listPrice,validDays}]}; requires login. workingDays Sun=0 ... Sat=6.

## Member
GET /member/dashboard -> {member:{id,name,phone,joinedAt},passes:Pass[],reservations:Reservation[]}
PATCH /member/profile {name,phone} -> {ok:true}
POST /member/reservations {passId,trainerId,startsAt} -> {reservation:Reservation}
POST /member/reservations/:id/cancel -> {ok:true}
Pass = {id,memberId,memberName,typeId,typeName,purchasedOn,paidAmount,expiresOn,totalSessions,usedSessions,bookedSessions,remainingSessions,availableSessions,isUsable:boolean}
Reservation = {id,memberId,memberName,passId,typeName,trainerId,trainerName,startsAt,status,note:string}

## Staff/admin operations (staff auth)
GET /admin/dashboard -> {membersCount,bookedCount,todayCount,expiringPasses:Pass[],trainerStats:[{id,name,completedCount}]}
GET /admin/members?q= -> {members:[{id,name,phone,email,joinedAt}]}; query name or last phone digits.
PATCH /admin/members/:id {name,phone} -> {ok:true}
GET /admin/passes?memberId= -> {passes:Pass[]}
POST /admin/passes {memberId,typeId,purchasedOn,paidAmount,expiresOn?} -> {pass:Pass}
GET /admin/reservations?date=&status= -> {reservations:Reservation[]}; omitted filters = all.
PATCH /admin/reservations/:id {status?,note?} -> {ok:true}
POST /admin/trainers {name,workingDays} -> {trainer:{id,name,workingDays}}
PATCH /admin/trainers/:id {name,workingDays} -> {ok:true}
POST /admin/pass-types {name,totalSessions,listPrice,validDays} -> {passType:...}
PATCH /admin/pass-types/:id {name,totalSessions,listPrice,validDays} -> {ok:true}

## Admin role only
GET /admin/staff -> {staff:[{id,email,name,role,isActive,mustChangePassword}]}
POST /admin/staff {email,name,role:'admin'|'employee'} -> {staff:...,temporaryPassword:string}
PATCH /admin/staff/:id {name?,role?,isActive?} -> {ok:true}; protect last active admin and accidental self-disable.
POST /admin/staff/:id/reset-password -> {temporaryPassword:string}; revoke existing sessions, require password change after next login.

## Setup and safety
Backend dotenv reads .env (never committed). Uses DATABASE_URL and DATABASE_SSL=true; only creates/changes hw2 schema. Separate tables from old assignments. Initial admin seed reads INITIAL_ADMIN_EMAIL/PASSWORD; no committed credentials. Idempotent seed includes fake members/passes/trainers/reservations sufficient to demonstrate expired/used/expiring/completed/noshow. Backend scripts db:setup and db:seed (startup may idempotently ensure).
Each frontend own package.json, lockfile, Next.js app, README. Use versions from bookclub-level2 existing package if possible. Use Node.js 22 or later and pnpm.

## Purchase receipt image attachment (implemented extension)
- POST /admin/passes/:id/receipts {fileName,mimeType,dataBase64} -> {receipts:Receipt[]} (staff only)
- GET /admin/passes/:id/receipts -> {receipts:Receipt[]} (staff only)
- GET /member/passes/:id/receipts -> {receipts:Receipt[]} (own member only)
- Receipt = {id,fileName,mimeType,dataUrl,createdAt}
- JPG/PNG/WebP only, actual file magic/MIME check, filename up to 120 characters, decoded file up to 2MB, up to 5 files per pass, total decoded files per pass <=3,000,000 bytes.
- Stored permanently as bytea in hw2.pass_receipts with pass/uploader foreign keys; no update/delete/OCR or payment verification.

## Trainer approval (2026-11-06)
Reservation additionally returns `approval: 'pending'|'approved'|'rejected'`. `status` retains its existing four values; rejection is `status:'cancelled', approval:'rejected'`. Bookings and reschedules with a linked trainer require approval; legacy reservations and trainers without a linked staff account remain approved. Member cards treat a missing approval field as the legacy approved state. Creation/reschedule success copy uses the returned approval when present and asks the member to check current reservation details when the old server omits it.

## Member availability, change requests, and audit history (2026-11-06)
- GET `/member/availability?passId=&trainerId=&month=YYYY-MM[&reservationId=]` returns `{days:[{date,slots:[{id,startsAt,endsAt}]}]}`. Only approved public slots with remaining capacity are returned, filtered by the member's pass, booking conflicts and time. Supplying an own booked `reservationId` excludes that reservation when checking capacity and permits moving the final reserved pass session.
- Both new bookings and change requests choose actual server-returned slots; the member app does not generate free-form dates or hours. The server rechecks availability on writes.
- POST `/member/reservations/:id/reschedule {startsAt}` returns `{reservation}` with `pendingChange: {id,startsAt,requestedAt}`. Original `reservation.startsAt` and `approval` remain unchanged until trainer approval. Only one request can be pending. A requested time is not held and is rechecked on approval.
- POST `/member/reservations/:id/changes/:requestId/withdraw {}` withdraws an own pending request. Cancelling/completing/no-showing the lesson also closes a pending request with a withdrawal event.
- GET `/member/reservations/:id/history` returns `{history:[{id,event,actorName,actorRole,changedAt,before,after}]}` for an own reservation. Roles: `member|trainer|admin|employee`. Events: `requested|approved_change|rejected_change|withdrawn|booked|approval|status|feedback`. Before/after objects contain the applicable `startsAt`, `note`, `status`, and/or `approval` fields. Existing reservations may have no historical events from before auditing was added.
- The member BFF preserves the availability query, allows only member history/withdraw paths, and does not permit trainer approval or admin routes.
