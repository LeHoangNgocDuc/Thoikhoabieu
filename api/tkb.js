import {json,sessionState,sameOrigin,clearCookie,renewSessionIfNeeded,API_VERSION} from './_auth.js';
export default async function handler(req,res){
 const session=sessionState(req);
 if(req.method==='GET'&&req.query?.action==='session')
  return json(res,200,{ok:true,authenticated:session.authenticated,code:session.authenticated?'AUTHENTICATED':session.code,
   backendConfigured:Boolean(process.env.GAS_URL&&process.env.GAS_API_KEY),apiVersion:API_VERSION,now:new Date().toISOString()});
 if(req.method==='POST'&&req.body?.op==='logout'){
  if(!sameOrigin(req))return json(res,403,{ok:false,code:'INVALID_ORIGIN',error:'Origin không hợp lệ',apiVersion:API_VERSION});
  res.setHeader('Set-Cookie',clearCookie);return json(res,200,{ok:true,apiVersion:API_VERSION});
 }
 if(!session.authenticated)return json(res,401,{ok:false,authenticated:false,code:session.code,
  error:session.code==='SESSION_EXPIRED'?'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.':'Chưa đăng nhập Smart TKB trên thiết bị này.',apiVersion:API_VERSION});
 if(req.method==='POST'&&!sameOrigin(req))return json(res,403,{ok:false,code:'INVALID_ORIGIN',error:'Origin không hợp lệ',apiVersion:API_VERSION});
 if(!['POST','GET'].includes(req.method))return json(res,405,{ok:false,code:'METHOD_NOT_ALLOWED',error:'Phương thức không hỗ trợ',apiVersion:API_VERSION});
 if(!process.env.GAS_URL||!process.env.GAS_API_KEY)return json(res,503,{ok:false,code:'BACKEND_NOT_CONFIGURED',error:'Chưa cấu hình kết nối Apps Script',apiVersion:API_VERSION});
 const body=req.method==='GET'?{op:'load'}:req.body;
 const operations=['load','bootstrap','save','delete','replaceVersion','splitExtraPattern','endExtraPattern','saveOfficialChange','undoOfficialChange','mutateExtra','diagnoseExtra','probeExtra','listExtra','extraStatus'];
 if(!body||!operations.includes(body.op))return json(res,400,{ok:false,code:'UNSUPPORTED_ACTION',error:'Thao tác không được hỗ trợ',apiVersion:API_VERSION});
 const payload=JSON.stringify({...body,apiKey:process.env.GAS_API_KEY});
 if(payload.length>1_200_000)return json(res,413,{ok:false,code:'PAYLOAD_TOO_LARGE',error:'Dữ liệu quá lớn',apiVersion:API_VERSION});
 try{
   const answer=await fetch(process.env.GAS_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:payload,redirect:'follow',signal:AbortSignal.timeout(25000),cache:'no-store'});
   if(!answer.ok)return json(res,502,{ok:false,code:'UPSTREAM_ERROR',error:'Apps Script không phản hồi thành công ('+answer.status+').',apiVersion:API_VERSION});
   const output=await answer.text();let parsed;
   try{parsed=JSON.parse(output);}catch{return json(res,502,{ok:false,code:'UPSTREAM_ERROR',error:'Apps Script không trả về JSON. Kiểm tra URL /exec và quyền triển khai.',apiVersion:API_VERSION});}
   if(body.op==='mutateExtra'&&parsed.ok===true&&parsed.verified!==true){
     return json(res,409,{ok:false,code:'WRITE_NOT_VERIFIED',stage:'apps-script',entityId:parsed.entityId||'',requestId:body.requestId,apiVersion:API_VERSION,
       error:'Máy chủ chưa xác minh bản ghi. Kiểm tra đồng bộ với requestId trước khi thử lại.'});
   }
   if(parsed.ok===false){
     const oldBackend=/thao tác không được hỗ trợ|UNSUPPORTED_ACTION/i.test(String(parsed.error||''));
     return json(res,oldBackend?409:502,{...parsed,code:oldBackend?'UNSUPPORTED_ACTION':(parsed.code||'SHEETS_READ_FAILED'),stage:'apps-script',apiVersion:API_VERSION,
       error:oldBackend?'Google Apps Script đang chạy mã cũ. Hãy triển khai phiên bản mới rồi kiểm tra máy chủ.':parsed.error||'Lỗi đọc Google Sheets'});
   }
   renewSessionIfNeeded(req,res);
   return json(res,200,{...parsed,stage:'apps-script',apiVersion:API_VERSION,gasVersion:parsed.apiVersion||null});
 }catch(e){
   const timeout=e?.name==='TimeoutError'||e?.name==='AbortError';
   return json(res,502,{ok:false,code:timeout?'UPSTREAM_TIMEOUT':'UPSTREAM_ERROR',error:timeout?'Apps Script phản hồi quá thời gian. Hãy thử lại.':'Không kết nối được Apps Script. Kiểm tra cấu hình và nhật ký Vercel.',apiVersion:API_VERSION});
 }
}
