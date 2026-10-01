const MODEL_URL='https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
let stream=null,timer=null,busy=false,ready=false;
let blink={closed:false,count:0,lastBlink:0};

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
    blink={closed:false,count:0,lastBlink:0};
    $('status').textContent='Kamera aktif — arahkan wajah ke kamera';
    timer=setInterval(scan,250);
  }catch(e){
    $('status').textContent='Kamera gagal: '+e.message;
  }
}

function stop(){
  if(timer){clearInterval(timer);timer=null;}
  if(stream)stream.getTracks().forEach(x=>x.stop());
  stream=null;
  busy=false;
  blink={closed:false,count:0,lastBlink:0};
  $('status').textContent='Kamera berhenti';
}

function eyeAspectRatio(p){
  const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  return (d(p[1],p[5])+d(p[2],p[4]))/(2*d(p[0],p[3])||1);
}

function getEAR(landmarks){
  const left=eyeAspectRatio(landmarks.getLeftEye());
  const right=eyeAspectRatio(landmarks.getRightEye());
  return (left+right)/2;
}

async function scan(){
  if(busy||!stream||!ready)return;
  const v=$('video');
  if(v.readyState<2)return;

  try{
    const d=await faceapi
      .detectSingleFace(v,new faceapi.TinyFaceDetectorOptions({inputSize:320,scoreThreshold:.45}))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if(!d){
      $('status').textContent='Mencari wajah...';
      return;
    }

    const e=getEAR(d.landmarks);

    // EAR bervariasi menurut kamera/wajah. Gunakan ambang yang lebih toleran
    // dan cukup 1 kedipan untuk liveness agar tidak mudah gagal.
    if(e<.24){
      blink.closed=true;
    }else if(blink.closed && e>.27){
      const now=Date.now();
      if(now-blink.lastBlink>700){
        blink.count++;
        blink.lastBlink=now;
      }
      blink.closed=false;
    }

    if(blink.count<1){
      $('status').textContent='Wajah terdeteksi — silakan kedip sekali';
      return;
    }

    busy=true;
    $('status').textContent='Kedipan terdeteksi — mencocokkan wajah...';

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
    blink={closed:false,count:0,lastBlink:0};
    setTimeout(()=>{busy=false},1800);
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
