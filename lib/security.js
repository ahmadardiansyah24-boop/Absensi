import crypto from 'node:crypto';

export function requireAdmin(req){
  const expected=process.env.ADMIN_API_KEY;
  if(!expected) throw Object.assign(new Error('ADMIN_API_KEY belum dikonfigurasi.'),{status:503});
  const got=String(req.headers['x-admin-key']||'');
  const a=Buffer.from(got), b=Buffer.from(expected);
  const ok=a.length===b.length && crypto.timingSafeEqual(a,b);
  if(!ok) throw Object.assign(new Error('Akses admin ditolak.'),{status:401});
}

export function validateDescriptor(d){
  if(!Array.isArray(d)||d.length!==128||d.some(v=>typeof v!=='number'||!Number.isFinite(v))) return false;
  const norm=Math.sqrt(d.reduce((s,v)=>s+v*v,0));
  return norm>0 && norm<10;
}

export function cleanText(v,max=80){return String(v??'').trim().replace(/[<>]/g,'').slice(0,max)}

export async function readJson(req,maxBytes=100000){
  return new Promise((resolve,reject)=>{
    let s='', bytes=0;
    req.on('data',c=>{
      bytes+=Buffer.byteLength(c);
      if(bytes>maxBytes){ reject(Object.assign(new Error('Request terlalu besar.'),{status:413})); req.destroy(); return; }
      s+=c;
    });
    req.on('end',()=>{ try{ resolve(s?JSON.parse(s):{}); }catch(e){ reject(Object.assign(new Error('JSON tidak valid.'),{status:400})); } });
    req.on('error',reject);
  });
}
