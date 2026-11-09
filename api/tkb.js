import {json,authorized,sameOrigin,clearCookie} from './_auth.js';
export default async function handler(req,res){
 if(req.method==='GET'&&req.query?.action==='session')return json(res,200,{authenticated:authorized(req),backendConfigured:Boolean(process.env.GAS_URL&&process.env.GAS_API_KEY)});
 if(req.method==='POST'&&req.body?.op==='logout'){res.setHeader('Set-Cookie',clearCookie);return json(res,200,{ok:true});}
 if(!authorized(req))return json(res,401,{error:'Cần đăng nhập'});
 if(req.method==='POST'&&!sameOrigin(req))return json(res,403,{error:'Origin không hợp lệ'});
 if(!['POST','GET'].includes(req.method))return json(res,405,{error:'Phương thức không hỗ trợ'});
 if(!process.env.GAS_URL||!process.env.GAS_API_KEY)return json(res,503,{error:'Chưa cấu hình kết nối Google Apps Script'});
 const body=req.method==='GET'?{op:'load'}:req.body;
 if(!body||!['load','bootstrap','save','delete','replaceVersion'].includes(body.op))return json(res,400,{error:'Thao tác không được hỗ trợ'});
 const payload=JSON.stringify({...body,apiKey:process.env.GAS_API_KEY});
 if(payload.length>1_200_000)return json(res,413,{error:'Dữ liệu quá lớn'});
 try{
   const answer=await fetch(process.env.GAS_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:payload,redirect:'follow',signal:AbortSignal.timeout(25000)});
   const output=await answer.text();let parsed;
   try{parsed=JSON.parse(output);}catch{return json(res,502,{error:'Apps Script không trả về JSON. Kiểm tra URL /exec và quyền triển khai.'});}
   return json(res,parsed.ok===false?400:200,parsed);
 }catch(e){return json(res,502,{error:`Không kết nối được Apps Script: ${e.message}`});}
}
