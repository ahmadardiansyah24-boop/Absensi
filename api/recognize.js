import {sb,json,distance} from '../lib/supabase.js';
import {validateDescriptor,cleanText,readJson} from '../lib/security.js';
function jakartaNow(){
  const d=new Date(),parts=new Intl.DateTimeFormat('en-CA',{timeZone:process.env.ATTENDANCE_TIMEZONE||'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,hourCycle:'h23'}).formatToParts(d);
  const o=Object.fromEntries(parts.map(x=>[x.type,x.value])); return {date:`${o.year}-${o.month}-${o.day}`,time:`${o.hour}:${o.minute}:${o.second}`};
}
export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,message:'Method not allowed'});
  try{
    const b=await readJson(req),desc=b.descriptor,session=cleanText(b.session||'MASUK',20).toUpperCase(),device=cleanText(b.device_id||'web',80);
    if(!validateDescriptor(desc))return json(res,422,{ok:false,message:'Descriptor wajah tidak valid.'});
    if(!/^[A-Z0-9_-]{1,20}$/.test(session))return json(res,422,{ok:false,message:'Sesi tidak valid.'});
    const rows=await sb('face_profiles?active=eq.true&select=student_id,descriptor_json,students!inner(id,nis,name,class_name,active)',{method:'GET'});
    let best=null,bestDist=999;
    for(const r of rows){if(!r.students?.active)continue;const d=distance(desc,r.descriptor_json||[]);if(d<bestDist){bestDist=d;best=r}}
    const threshold=Number(process.env.FACE_MATCH_THRESHOLD||0.48);
    if(!best||bestDist>threshold)return json(res,200,{ok:false,message:'Wajah tidak dikenali.'});
    const now=jakartaNow(),lateAfter=process.env.ATTENDANCE_LATE_AFTER||'07:00',status=now.time.slice(0,5)>lateAfter?'Terlambat':'Hadir';
    const rpc=await sb('rpc/record_face_attendance',{method:'POST',body:JSON.stringify({p_student_id:best.student_id,p_date:now.date,p_session:session,p_status:status,p_recorded_at:now.time,p_distance:bestDist,p_device:device})});
    const result=Array.isArray(rpc)?rpc[0]:rpc;
    if(!result?.ok)return json(res,200,{ok:false,duplicate:true,message:`Sudah absen hari ini pada ${result?.recorded_at||'-'}.`});
    const s=best.students;
    return json(res,200,{ok:true,student:{id:s.id,nis:s.nis,name:s.name,class_name:s.name,class_name:s.class_name},attendance:{status:result.status,time:result.recorded_at,distance:Number(bestDist.toFixed(4))}});
  }catch(e){return json(res,e.status||500,{ok:false,message:e.message||'Server error'})}
}
