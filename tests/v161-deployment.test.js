import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createCookie} from '../api/_auth.js';
import handler from '../api/tkb.js';

const gas=fs.readFileSync(new URL('../gas/Code.gs',import.meta.url),'utf8');
function appsScriptProbe(){
 const c={JSON,Date,String,Number,Array,Math,RegExp,Object,Set,
  PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'private-token'})},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({data:s,setMimeType(){return this;}})},
  SpreadsheetApp:{getActiveSpreadsheet:()=>({getName:()=> 'SMART_TKB_TEST',getId:()=> 'TEST_GOOGLE_SHEET_123456'})} };
 vm.createContext(c);
 vm.runInContext(gas+'\nthis.post=doPost;',c);
 vm.runInContext(`initSheets_=()=>{};read_=(name)=>[];`,c);
 const r=c.post({postData:{contents:JSON.stringify({apiKey:'private-token',op:'probeExtra'})}});
 return JSON.parse(r.data);
}
function response(){return {statusCode:200,headers:{},status(n){this.statusCode=n;return this;},setHeader(k,v){this.headers[k]=v;return this;},end(s){this.body=JSON.parse(s);}};}
async function proxyCall(reply){
 const old=globalThis.fetch;
 globalThis.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify(reply)});
 process.env.APP_PASSWORD='pass';process.env.SESSION_SECRET='secret-with-at-least-64-characters-random-enough-for-test-12345678900';
 process.env.GAS_URL='https://script.google.com/macros/s/test/exec';process.env.GAS_API_KEY='hidden';
 const req={method:'POST',headers:{host:'localhost',origin:'http://localhost',cookie:createCookie().split(';')[0]},body:{op:'probeExtra'}};
 const res=response();
 try{await handler(req,res);return res;}finally{globalThis.fetch=old;}
}
test('V1.6.1 Apps Script declares probe and supports all recurring tutoring mutations',()=>{
 const r=appsScriptProbe();assert.equal(r.ok,true);assert.equal(r.extraWrites,true);
 assert.equal(r.apiVersion,'1.8.0');assert.ok(r.supportedActions.includes('EDIT_FUTURE'));
 assert.ok(r.supportedActions.includes('CREATE'));
});
test('Vercel proxy identifies outdated Apps Script rather than generic unsupported action',async()=>{
 const r=await proxyCall({ok:false,error:'Thao tác không được hỗ trợ'});
 assert.equal(r.statusCode,409);assert.equal(r.body.stage,'apps-script');
 assert.match(r.body.error,/Apps Script ở GAS_URL chưa hỗ trợ thao tác probeExtra/);
 assert.ok(!JSON.stringify(r.body).includes('private-token'));
});
test('Vercel proxy accepts positive capability probe',async()=>{
 const r=await proxyCall({ok:true,apiVersion:'1.6.5',extraWrites:true,verifiedWrites:true,supportedActions:['CREATE']});
 assert.equal(r.statusCode,200);assert.equal(r.body.extraWrites,true);assert.equal(r.body.stage,'apps-script');assert.equal(r.body.gasVersion,'1.6.5');
});
