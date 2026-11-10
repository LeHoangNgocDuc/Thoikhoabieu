import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import login from '../api/login.js';
import tkb from '../api/tkb.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const seed=JSON.parse(fs.readFileSync(path.join(root,'public/seed.json'),'utf8'));
const names=['8A_NC','8A_NC','9A_NC','9A_NC','10','10','8B_CB','12'];
const patterns=names.map((n,i)=>({id:'test-pattern-'+i,day:i<6?8:2,shift:i<2?'S':i<4?'S':i<6?'C':'T',period:i%2+1,subject:'Toán',groups:[n],fromDate:'2026-11-09',active:true,repeatRule:'weekly',startLesson:1}));
const data={...seed,extra_patterns:patterns,extra_sessions:[],extra_requests:[],audit_log:[]};
const upstream=http.createServer(async (req,res)=>{
 let raw='';for await(const chunk of req)raw+=chunk;
 const body=JSON.parse(raw||'{}');
 let result={ok:false,error:'UNSUPPORTED_ACTION'};
 if(body.op==='load')result={ok:true,data,apiVersion:'1.6.2'};
 if(body.op==='probeExtra')result={ok:true,apiVersion:'1.6.2',extraWrites:true,verifiedWrites:true,supportedActions:['CREATE','EDIT_FUTURE','EDIT_ONCE']};
 if(body.op==='listExtra')result={ok:true,apiVersion:'1.6.2',patterns,sessions:[],counts:{patterns:8,exceptions:0}};
 res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));
});
await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
process.env.APP_PASSWORD='test-v163-browser-only';
process.env.SESSION_SECRET='BROWSER_TEST_SECRET_64_BYTES_DEMO_TEST_ONLY_1234567890abcdef9876543';
process.env.GAS_API_KEY='browser-test-api-key';
process.env.GAS_URL=`http://127.0.0.1:${upstream.address().port}/exec`;
const MIME={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const server=http.createServer(async (req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/api/login'||pathname==='/api/tkb'){
  const url=new URL(req.url,'http://localhost');req.query=Object.fromEntries(url.searchParams);
  if(req.method==='POST'){let raw='';for await(const ch of req)raw+=ch;try{req.body=JSON.parse(raw);}catch{req.body={};}}
  return (pathname==='/api/login'?login:tkb)(req,res);
 }
 const normalized=pathname==='/'?'index.html':pathname==='\/favicon.svg'?'public/favicon.svg':pathname==='\/seed.json'?'public/seed.json':pathname.slice(1);
 const file=path.join(root,normalized);
 if(!file.startsWith(root)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end('Not found');}
 res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'localhost',resolve));
console.log(`LOCAL_V163_URL=http://localhost:${server.address().port}`);
