const MODEL_URL='https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
let stream=null,timer=null,busy=false,ready=false,lastAttempt=0;
const $=x=>document.getElementById(x);

async function models(){
  if(ready)return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
  ]);
  ready=true;
}

async function start(){
  try{
    await models();
    if(stream)return;
    stream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:{ideal:'user'},width:{ideal:1280},height:{ideal:720}},
      audio:false
    });
    $('video').srcObject=stream;
    await $('video').play().catch(()=>{});
    $('status').textContent='Kamera aktif — arahkan wajah ke kamera';
    timer=setInterval(scan,450);
  }catch(e){
    $('status').textContent='Kamera gagal: '+e.message;
  }
}

function stop(){
  if(timer){clearInterval(timer);timer=null;}
  if(stream)stream.getTracks().forEach(x=>x.stop());
  stream=null;
  busy=false;
  $('status').textContent='Kamera berhenti';
}

async function scan(){
  if(busy||!stream||!ready)return;
  if(Date.now()-lastAttempt<2000)return;

  const v=$('video');
  if(v.readyState<2)return;

  try{
    const d=await faceapi
      .detectSingleFace(
        v,
        new faceapi.TinyFaceDetectorOptions({inputSize:320,scoreThreshold:.45})
      )
      .withFaceLandmarks()
      .withFaceDescriptor();

    if(!d){
      $('status').textContent='Mencari wajah...';
      return;
    }

    // Tidak lagi meminta kedipan. Begitu wajah terdeteksi,
    // descriptor langsung dikirim ke server untuk pencocokan.
    busy=true;
    lastAttempt=Date.now();
    $('status').textContent='Wajah terdeteksi — mencocokkan...';

    const r=await fetch('/api/recognize',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        descriptor:Array.from(d.descriptor),
        session:'MASUK',
        device_id:navigator.userAgent.slice(0,80)
      })
    });

    const j=await r.json();
    show(j);
  }catch(e){
    show({ok:false,message:e.message||'Gagal memproses wajah.'});
  }finally{
    setTimeout(()=>{busy=false},1200);
  }
}

function show(j){
  const r=$('result');
  r.classList.remove('hidden');
  r.innerHTML=j.ok
    ? `<b>✅ ${j.student.name}</b><br>${j.student.class_name}<br><strong>${j.attendance.status}</strong> — ${j.attendance.time}`
    : `<b>⚠️ ${j.message}</b>`;

  if(j.ok){
    $('hadir').textContent=+$('hadir').textContent+1;
    if(j.attendance.status==='Terlambat')$('late').textContent=+$('late').textContent+1;
  }else{
    $('rejected').textContent=+$('rejected').textContent+1;
  }
}

$('start').onclick=start;
$('stop').onclick=stop;
