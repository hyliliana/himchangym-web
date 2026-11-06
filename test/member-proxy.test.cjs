const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {NextRequest}=require('next/server');
const moduleScope={exports:{}};
new Function('exports','module','require',ts.transpileModule(fs.readFileSync('app/api/[...path]/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(moduleScope.exports,moduleScope,require);
const route=moduleScope.exports;
function request(path,options){return [new NextRequest('http://member.test/api/'+path,options),{params:Promise.resolve({path:path.split('?')[0].split('/')})}];}
test('member proxy preserves availability query and forwards narrow lesson-history/withdraw endpoints',async()=>{
  const originalFetch=global.fetch,originalBase=process.env.BACKEND_URL;process.env.BACKEND_URL='http://backend.test';
  const calls=[];global.fetch=async(url,init)=>{calls.push({url,init});return Response.json({days:[],history:[],ok:true});};
  try{
    const query='member/availability?passId=7&trainerId=8&month=2026-11&reservationId=9';
    assert.equal((await route.GET(...request(query,{headers:{cookie:'gym_session=test-session'}}))).status,200);
    assert.equal(calls[0].url,'http://backend.test/'+query);assert.equal(calls[0].init.headers.Authorization,'Bearer test-session');
    assert.equal((await route.GET(...request('member/reservations/9/history'))).status,200);
    assert.equal((await route.POST(...request('member/reservations/9/changes/4/withdraw',{method:'POST',headers:{host:'member.test',origin:'http://member.test','content-type':'application/json'},body:'{}'}))).status,200);
    assert.equal(calls.at(-1).url,'http://backend.test/member/reservations/9/changes/4/withdraw');
    const count=calls.length;
    assert.equal((await route.GET(...request('admin/reservations'))).status,404);
    assert.equal((await route.POST(...request('member/reservations/9/changes/4/approve',{method:'POST'}))).status,404);
    assert.equal((await route.POST(...request('member/reservations/9/changes/4/withdraw',{method:'POST',headers:{host:'member.test',origin:'http://foreign.test'}}))).status,403);
    assert.equal(calls.length,count,'forbidden routes and cross-origin writes never reach the backend');
  }finally{global.fetch=originalFetch;if(originalBase===undefined)delete process.env.BACKEND_URL;else process.env.BACKEND_URL=originalBase;}
});
