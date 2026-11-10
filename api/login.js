import {json,safeEqual,createCookie,sameOrigin,API_VERSION} from './_auth.js';
export default async function handler(req,res){
 if(req.method!=='POST')return json(res,405,{ok:false,code:'METHOD_NOT_ALLOWED',error:'Chỉ chấp nhận POST',apiVersion:API_VERSION});
 if(!sameOrigin(req))return json(res,403,{ok:false,code:'INVALID_ORIGIN',error:'Origin không hợp lệ',apiVersion:API_VERSION});
 if(!process.env.APP_PASSWORD||!process.env.SESSION_SECRET)return json(res,503,{ok:false,code:'AUTH_NOT_CONFIGURED',error:'Chưa cấu hình đăng nhập trên Vercel',apiVersion:API_VERSION});
 if(!safeEqual(req.body?.password,process.env.APP_PASSWORD))return json(res,401,{ok:false,code:'INVALID_CREDENTIALS',error:'Mật khẩu không đúng',apiVersion:API_VERSION});
 res.setHeader('Set-Cookie',createCookie());return json(res,200,{ok:true,authenticated:true,apiVersion:API_VERSION});
}
