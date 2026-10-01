import {sb,json,distance} from '../lib/supabase.js';
import {requireAdmin,validateDescriptor,cleanText,readJson} from '../lib/security.js';

export default async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{ok:false,message:'Method not allowed'});
  try{
    requireAdmin(req);
    const b=await readJson(req),nis=cleanText(b.nis,30),name=cleanText(b.name,120),class_name=cleanText(b.class_name,60),ds=b.descriptors||[];
    if(!nis||!name||!class_name||ds.length<3||ds.length>5||ds.some(d=>!validateDescriptor(d)))
      return json(res,422,{ok:false,message:'Data tidak valid. NIS, nama, kelas dan 3–5 descriptor wajah diperlukan.'});
    const students=await sb(`students?nis=eq.${encodeURIComponent(nis)}&select=id,nis,name,class_name,active&limit=1`,{method:'GET'});
    let student;
    if(students.length){
      student=students[0];
      if(!student.active) return json(res,409,{ok:false,message:'Siswa tidak aktif.'});
      await sb(`students?id=eq.${student.id}`,{method:'PATCH',body:JSON.stringify({name,class_name,updated_at:new Date().toISOString()})});
    }else{
      const created=await sb('students',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({nis,name,class_name})});
      student=created[0];
    }
    const avg=ds[0].map((_,i)=>ds.reduce((s,d)=>s+d[i],0)/ds.length);
    const existing=await sb('face_profiles?active=eq.true&select=id,student_id,descriptor_json',{method:'GET'});
    for(const p of existing){
      if(p.student_id!==student.id && distance(avg,p.descriptor_json||[])<0.45)
        return json(res,409,{ok:false,message:'Wajah ini terindikasi sudah terdaftar pada siswa lain.'});
    }
    await sb(`face_profiles?student_id=eq.${student.id}&active=eq.true`,{method:'PATCH',body:JSON.stringify({active:false,updated_at:new Date().toISOString()})});
    await sb('face_profiles',{method:'POST',body:JSON.stringify({student_id:student.id,descriptor_json:avg,sample_count:ds.length,active:true})});
    return json(res,200,{ok:true,message:`Wajah ${name} berhasil didaftarkan.`});
  }catch(e){return json(res,e.status||500,{ok:false,message:e.message||'Server error'})}
}
