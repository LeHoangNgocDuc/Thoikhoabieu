import {json,authorized,sameOrigin,clearCookie} from './_auth.js';
export default async function handler(req,res){
 if(req.method==='GET'&&req.query?.action==='session')return json(res,200,{authenticated:authorized(req),backendConfigured:Boolean(process.env.GAS_URL&&process.env.GAS_API_KEY)});
 if(req.method==='POST'&&req.body?.op==='logout'){res.setHeader('Set-Cookie',clearCookie);return json(res,200,{ok:true});}
 if(!authorized(req))return json(res,401,{error:'Cần đăng nhập'});
 if(req.method==='POST'&&!sameOrigin(req))return json(res,403,{error:'Origin không hợp lệ'});
 if(!['POST','GET'].includes(req.method))return json(res,405,{error:'Phương thức không hỗ trợ'});
 if(!process.env.GAS_URL||!process.env.GAS_API_KEY)return json(res,503,{error:'Chưa cấu hình kết nối Google Apps Script'});
 const body=req.method==='GET'?{op:'load'}:req.body;
 if(!body||!['load','bootstrap','save','delete','replaceVersion','splitExtraPattern','endExtraPattern','saveOfficialChange','undoOfficialChange','mutateExtra','diagnoseExtra','probeExtra'].includes(body.op))return json(res,400,{error:'Thao tác không được hỗ trợ'});
 const payload=JSON.stringify({...body,apiKey:process.env.GAS_API_KEY});
 if(payload.length>1_200_000)return json(res,413,{error:'Dữ liệu quá lớn'});
 try{
   const answer=await fetch(process.env.GAS_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:payload,redirect:'follow',signal:AbortSignal.timeout(25000)});
   const output=await answer.text();let parsed;
   try{parsed=JSON.parse(output);}catch{return json(res,502,{error:'Apps Script không trả về JSON. Kiểm tra URL /exec và quyền triển khai.'});}
   if(parsed.ok===false){
     const oldBackend=/thao tác không được hỗ trợ/i.test(String(parsed.error||''));
     return json(res,oldBackend?409:400,{...parsed,stage:'apps-script',
       error:oldBackend?'Google Apps Script đang chạy bản cũ, chưa hỗ trợ lưu dạy thêm V1.6.1. Vào Apps Script > Triển khai > Quản lý tùy chọn triển khai > Phiên bản mới, sau đó thử Kiểm tra máy chủ trong Smart TKB.':parsed.error});
   }
   return json(res,200,{...parsed,stage:'apps-script'});
 }catch(e){return json(res,502,{error:`Không kết nối được Apps Script: ${e.message}`});}
}
