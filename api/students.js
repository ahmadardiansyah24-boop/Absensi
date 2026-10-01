import {sb,json} from '../lib/supabase.js';
import {requireAdmin} from '../lib/security.js';

export default async function handler(req,res){
  if(req.method!=='GET') return json(res,405,{ok:false,message:'Method not allowed'});
  try{
    requireAdmin(req);
    const rows=await sb('students?select=id,nis,name,class_name,active,created_at,face_profiles(id,active,sample_count,registered_at)&order=class_name.asc,name.asc',{method:'GET'});
    const students=(rows||[]).map(s=>({
      id:s.id,nis:s.nis,name:s.name,class_name:s.class_name,active:s.active,
      registered:!!(s.face_profiles||[]).some(f=>f.active),
      sample_count:((s.face_profiles||[]).find(f=>f.active)?.sample_count)||0,
      registered_at:((s.face_profiles||[]).find(f=>f.active)?.registered_at)||null
    }));
    return json(res,200,{ok:true,count:students.length,students});
  }catch(e){
    return json(res,e.status||500,{ok:false,message:e.message||'Server error'});
  }
}
