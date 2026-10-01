function env(name){const v=process.env[name];if(!v)throw new Error(`Missing environment variable: ${name}`);return v}
export async function sb(path, options={}){
  const base=env('SUPABASE_URL').replace(/\/$/,'');
  const key=env('SUPABASE_SERVICE_ROLE_KEY');
  const headers={
    apikey:key,
    Authorization:`Bearer ${key}`,
    'Content-Type':'application/json',
    ...(options.headers||{})
  };
  const res=await fetch(`${base}/rest/v1/${path}`,{...options,headers});
  const text=await res.text();
  let data;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!res.ok){const e=new Error(typeof data==='string'?data:(data?.message||'Supabase request failed'));e.status=res.status;throw e}
  return data;
}
export function json(res,status,payload){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(payload))}
export function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>s+=c);req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}});req.on('error',reject)})}
export function distance(a,b){
  let dot=0,na=0,nb=0,n=Math.min(a.length,b.length);
  for(let i=0;i<n;i++){const x=+a[i],y=+b[i];dot+=x*y;na+=x*x;nb+=y*y}
  return (na&&nb)?1-dot/(Math.sqrt(na)*Math.sqrt(nb)):1;
}
