import {test} from 'node:test';
import assert from 'node:assert/strict';
import {json,createCookie,sessionState,sign} from '../api/_auth.js';
import login from '../api/login.js';
import tkb from '../api/tkb.js';

process.env.APP_PASSWORD='test-strong-password-for-v163';
process.env.SESSION_SECRET='test-session-secret-1234567890abcdefghijklmnopqrstu-9876543210';
process.env.GAS_URL='https://script.google.com/macros/s/Fake/exec';
process.env.GAS_API_KEY='test-hidden-gas-key';
const makeReq=(method,body={},cookie='',origin='https://thoikhoabieu-sage.vercel.app')=>({method,headers:{host:'thoikhoabieu-sage.vercel.app',origin,cookie},body,query:{}});
const makeRes=()=>({statusCode:200,headers:{},status(code){this.statusCode=code;return this;},setHeader(k,v){this.headers[k]=v;return this;},end(s){this.body=JSON.parse(s);}});
const authReq=async()=>{const res=makeRes();await login(makeReq('POST',{password:process.env.APP_PASSWORD}),res);return res.headers['Set-Cookie'].split(';')[0];};

test('login sets HttpOnly Secure Lax Path cookie scoped to browser host',async()=>{
 const res=makeRes();await login(makeReq('POST',{password:process.env.APP_PASSWORD}),res);
 assert.equal(res.statusCode,200);assert.equal(res.body.apiVersion,'1.8.4');
 for(const value of ['HttpOnly','Secure','SameSite=Lax','Path=/'])assert.match(res.headers['Set-Cookie'],new RegExp(value));
 assert.doesNotMatch(res.headers['Set-Cookie'],/Domain=/);
});
test('different device without cookie is unauthenticated even when desktop is logged in',async()=>{
 const desktop=await authReq();const p=makeRes();await tkb(makeReq('GET',{},'',undefined),p);
 assert.equal(p.statusCode,401);assert.equal(p.body.code,'UNAUTHENTICATED');
 const d=makeRes();await tkb({...makeReq('GET',{},desktop),query:{action:'session'}},d);
 assert.equal(d.statusCode,200);assert.equal(d.body.authenticated,true);
});
test('session endpoint distinguishes unauthenticated and authenticated and never exposes secrets',async()=>{
 const no=makeRes();await tkb({...makeReq('GET'),query:{action:'session'}},no);
 assert.equal(no.body.authenticated,false);assert.equal(no.body.code,'UNAUTHENTICATED');
 const cookie=await authReq();const yes=makeRes();await tkb({...makeReq('GET',{},cookie),query:{action:'session'}},yes);
 assert.equal(yes.body.authenticated,true);assert.equal(yes.body.backendConfigured,true);
 assert.match(yes.headers['Cache-Control'],/no-store/);
 assert.ok(!JSON.stringify(yes.body).includes(process.env.GAS_API_KEY));
});
test('expired signed session responds as SESSION_EXPIRED rather than Sheets error',async()=>{
 const exp=String(Math.floor(Date.now()/1000)-20);const cookie=`smart_tkb_session=${exp}.${sign(exp)}`;
 const r=makeRes();await tkb(makeReq('GET',{},cookie),r);assert.equal(r.statusCode,401);assert.equal(r.body.code,'SESSION_EXPIRED');
});
test('wrong password and cross-origin POST rejected with explicit code',async()=>{
 const r=makeRes();await login(makeReq('POST',{password:'bad'}),r);assert.equal(r.statusCode,401);assert.equal(r.body.code,'INVALID_CREDENTIALS');
 const other=makeRes();await login(makeReq('POST',{password:process.env.APP_PASSWORD},'', 'https://malicious.example'),other);
 assert.equal(other.statusCode,403);assert.equal(other.body.code,'INVALID_ORIGIN');
});
test('logging out one browser does not invalidate separate browser cookie',async()=>{
 const c1=await authReq(),c2=await authReq();const out=makeRes();await tkb(makeReq('POST',{op:'logout'},c1),out);
 assert.equal(out.statusCode,200);assert.match(out.headers['Set-Cookie'],/Max-Age=0/);
 const active=makeRes();await tkb({...makeReq('GET',{},c2),query:{action:'session'}},active);
 assert.equal(active.body.authenticated,true);
});
test('server reports upstream failure distinctly and never returns ok on missing Sheets data',async()=>{
 const cookie=await authReq();const orig=globalThis.fetch;
 globalThis.fetch=async()=>({ok:false,status:503});
 try{const r=makeRes();await tkb(makeReq('GET',{},cookie),r);assert.equal(r.statusCode,502);assert.equal(r.body.code,'UPSTREAM_ERROR');assert.equal(r.body.ok,false);}
 finally{globalThis.fetch=orig;}
});
test('server reads Apps Script response with no-store and version metadata',async()=>{
 const cookie=await authReq(),orig=globalThis.fetch;let captured;
 globalThis.fetch=async(url,options)=>{captured={url,options};return {ok:true,status:200,text:async()=>JSON.stringify({ok:true,data:{classes:[],extra_patterns:[]},apiVersion:'1.6.2'})};};
 try{const r=makeRes();await tkb(makeReq('GET',{},cookie),r);assert.equal(r.statusCode,200);assert.equal(r.body.apiVersion,'1.8.4');assert.equal(r.body.gasVersion,'1.6.2');assert.equal(captured.options.cache,'no-store');assert.equal(captured.options.method,'POST');}
 finally{globalThis.fetch=orig;}
});
