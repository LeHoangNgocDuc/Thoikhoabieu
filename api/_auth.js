import crypto from 'node:crypto';
const COOKIE_NAME='smart_tkb_session';
const DAY=86400;
export function json(res,status,data){res.status(status).setHeader('Content-Type','application/json; charset=utf-8').setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));}
export function safeEqual(a,b){if(!a||!b)return false;const x=Buffer.from(String(a));const y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);}
export function sign(payload){return crypto.createHmac('sha256',process.env.SESSION_SECRET||'').update(payload).digest('hex');}
export function getToken(req){const raw=String(req.headers.cookie||'');return (raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE_NAME+'='))||'').slice(COOKIE_NAME.length+1);}
export function authorized(req){
  if(!process.env.SESSION_SECRET||!process.env.APP_PASSWORD)return false;
  const parts=getToken(req).split('.');if(parts.length!==2)return false;
  const [exp,sig]=parts;
  if(!/^\d+$/.test(exp)||Number(exp)<Math.floor(Date.now()/1000))return false;
  return safeEqual(sig,sign(exp));
}
export function createCookie(){const exp=String(Math.floor(Date.now()/1000)+7*DAY);return `${COOKIE_NAME}=${exp}.${sign(exp)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7*DAY}`;}
export const clearCookie=`${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export function sameOrigin(req){const origin=req.headers.origin;if(!origin)return true;try{return new URL(origin).host===req.headers.host;}catch{return false;}}
