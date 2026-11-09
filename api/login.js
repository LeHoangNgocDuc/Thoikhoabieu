import {json,safeEqual,createCookie,sameOrigin} from './_auth.js';
export default async function handler(req,res){
 if(req.method!=='POST')return json(res,405,{error:'Chỉ chấp nhận POST'});
 if(!sameOrigin(req))return json(res,403,{error:'Origin không hợp lệ'});
 if(!process.env.APP_PASSWORD||!process.env.SESSION_SECRET)return json(res,503,{error:'Chưa cấu hình APP_PASSWORD và SESSION_SECRET trên Vercel'});
 if(!safeEqual(req.body?.password,process.env.APP_PASSWORD))return json(res,401,{error:'Mật khẩu không đúng'});
 res.setHeader('Set-Cookie',createCookie());return json(res,200,{ok:true});
}
