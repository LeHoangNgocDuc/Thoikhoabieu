import crypto from 'node:crypto';
export const API_VERSION = '1.7.0';
const COOKIE_NAME='smart_tkb_session';
const DAY=86400;
export function json(res,status,data){
 res.status(status).setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','private, no-store, max-age=0, must-revalidate');
 res.setHeader('Pragma','no-cache');res.setHeader('Vary','Cookie');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.end(JSON.stringify(data));
}
export function safeEqual(a,b){if(!a||!b)return false;const x=Buffer.from(String(a));const y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);}
export function sign(payload){return crypto.createHmac('sha256',process.env.SESSION_SECRET||'').update(payload).digest('hex');}
export function getToken(req){const raw=String(req.headers.cookie||'');return (raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE_NAME+'='))||'').slice(COOKIE_NAME.length+1);}
export function sessionState(req){
 if(!process.env.SESSION_SECRET||!process.env.APP_PASSWORD)return {authenticated:false,code:'AUTH_NOT_CONFIGURED'};
 const token=getToken(req);
 if(!token)return {authenticated:false,code:'UNAUTHENTICATED'};
 const parts=token.split('.');if(parts.length!==2)return {authenticated:false,code:'UNAUTHENTICATED'};
 const [exp,sig]=parts;
 if(!/^\d+$/.test(exp)||!safeEqual(sig,sign(exp)))return {authenticated:false,code:'UNAUTHENTICATED'};
 if(Number(exp)<=Math.floor(Date.now()/1000))return {authenticated:false,code:'SESSION_EXPIRED'};
 return {authenticated:true,expiresAt:Number(exp)};
}
export function authorized(req){return sessionState(req).authenticated;}
// Host-only secure cookie: independent login on each device, valid on this origin only.
export function createCookie(){const exp=String(Math.floor(Date.now()/1000)+7*DAY);return `${COOKIE_NAME}=${exp}.${sign(exp)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7*DAY}`;}
export const clearCookie=`${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
export function renewSessionIfNeeded(req,res){const s=sessionState(req);if(s.authenticated&&s.expiresAt-Math.floor(Date.now()/1000)<DAY)res.setHeader('Set-Cookie',createCookie());}
export function sameOrigin(req){const origin=req.headers.origin;if(!origin)return true;try{return new URL(origin).host===req.headers.host;}catch{return false;}}
