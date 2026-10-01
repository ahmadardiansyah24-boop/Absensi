let key=sessionStorage.getItem('adminKey')||prompt('Masukkan Admin API Key');
let data=[];const $=id=>document.getElementById(id);
if(key)sessionStorage.setItem('adminKey',key);
async function load(){
  if(!key){$('status').textContent='Admin API Key diperlukan.';return;}
  $('status').textContent='Memuat daftar siswa...';
  try{
    const r=await fetch('/api/students',{headers:{'X-Admin-Key':key}});
    const j=await r.json();
    if(!r.ok||!j.ok)throw new Error(j.message||'Gagal mengambil data');
    data=j.students||[];$('status').textContent='Total siswa: '+data.length;render();
  }catch(e){$('status').textContent='⚠️ '+e.message;}
}
function render(){
  const q=$('search').value.trim().toLowerCase();
  const rows=data.filter(s=>[s.nis,s.name,s.class_name].some(v=>String(v||'').toLowerCase().includes(q)));
  $('studentsTable').querySelector('tbody').innerHTML=rows.map((s,i)=>`<tr>
<td style="padding:10px;border-bottom:1px solid #eee">${i+1}</td>
<td style="padding:10px;border-bottom:1px solid #eee">${esc(s.nis)}</td>
<td style="padding:10px;border-bottom:1px solid #eee"><b>${esc(s.name)}</b></td>
<td style="padding:10px;border-bottom:1px solid #eee">${esc(s.class_name)}</td>
<td style="padding:10px;border-bottom:1px solid #eee">${s.registered?'✅ Terdaftar':'—'}</td></tr>`).join('')||'<tr><td colspan="5" style="padding:18px;text-align:center">Tidak ada data.</td></tr>';
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
$('search').oninput=render;$('refresh').onclick=load;load();