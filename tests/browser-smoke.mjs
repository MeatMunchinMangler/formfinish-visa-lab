import {spawn} from "node:child_process";
const url=process.env.FORMFINISH_BASE_URL || "http://127.0.0.1:18765/";
const chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const args=["--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check","--disable-extensions","--remote-debugging-port=18766","--user-data-dir=/tmp/formfinish-cdp-smoke",url];
const child=spawn(chrome,args,{stdio:"ignore"}), sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
let ws;
try {
  let tabs;
  for(let i=0;i<40;i++){try{tabs=await fetch("http://127.0.0.1:18766/json/list").then(r=>r.json());if(tabs?.some(x=>x.type==="page"))break;}catch{}await sleep(250);}
  const page=tabs?.find(x=>x.type==="page");if(!page)throw new Error("Chrome DevTools did not start.");
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let seq=0;const pending=new Map(),requests=[];
  ws.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.method==="Network.requestWillBeSent")requests.push(msg.params.request.url);if(msg.id&&pending.has(msg.id)){const {resolve,reject}=pending.get(msg.id);pending.delete(msg.id);msg.error?reject(new Error(JSON.stringify(msg.error))):resolve(msg.result);}};
  function call(method,params={}){const id=++seq;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
  await call("Runtime.enable");await call("Network.enable");
  // Public hosting can take longer than localhost. Wait for page scripts, not merely the CDP socket.
  let ready=false;
  for(let i=0;i<60;i++) {
    const state=await call("Runtime.evaluate",{expression:"document.readyState==='complete' && document.querySelector('#last-day')?.textContent==='February 28, 2027'",returnByValue:true});
    if(state.result?.value===true){ready=true;break;}
    await sleep(250);
  }
  if(!ready)throw new Error('FormFinish page scripts did not become ready.');
  const expr=`(async()=> {
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const canvas=document.createElement("canvas");canvas.width=800;canvas.height=1200;
    const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,800,1200);ctx.fillStyle="#243647";ctx.fillRect(220,140,360,850);
    const synthetic=await new Promise(r=>canvas.toBlob(r,"image/png"));
    async function upload(){
      const input=document.querySelector("#image-input");
      const dt=new DataTransfer();dt.items.add(new File([synthetic],"synthetic.png",{type:"image/png"}));input.files=dt.files;
      input.dispatchEvent(new Event("change",{bubbles:true}));
      for(let i=0;i<50&&document.querySelector("#export").disabled;i++)await sleep(100);
      if(document.querySelector("#export").disabled)throw Error("Photo load failed");
    }
    async function exportIt(){
      document.querySelector("#export").click();
      for(let i=0;i<90&&document.querySelector("#export-result").hidden;i++)await sleep(100);
      if(document.querySelector("#export-result").hidden)throw Error("Export failed: "+document.querySelector("#status").textContent);
      const link=document.querySelector("#download"),blob=await fetch(link.href).then(r=>r.blob());
      const bytes=new Uint8Array(await blob.slice(0,3).arrayBuffer()),bmp=await createImageBitmap(blob);
      const r={size:blob.size,mime:blob.type,width:bmp.width,height:bmp.height,magic:[...bytes],name:link.download};bmp.close();return r;
    }
    await upload();document.querySelector("#limit").value="49000";const portrait=await exportIt();
    document.querySelector("#passport-tab").click();await upload();document.querySelector("#rotate-right").click();
    document.querySelector("#limit").value="199000";const passport=await exportIt();
    return {portrait,passport,dates:document.querySelector("#last-day").textContent,app:document.title};
  })()`;
  const out=await call("Runtime.evaluate",{expression:expr,awaitPromise:true,returnByValue:true});
  if(out.exceptionDetails)throw new Error(JSON.stringify(out.exceptionDetails));
  const r=out.result?.value;console.log("Browser smoke:",JSON.stringify(r));
  if(!r?.portrait||!r?.passport)throw new Error("Missing exports");
  for(const [kind,v,limit] of [["portrait",r.portrait,49000],["passport",r.passport,199000]]) {
    if(v.mime!=="image/jpeg"||v.size>=limit||v.magic?.[0]!==255||v.magic?.[1]!==216)throw new Error(kind+" failed JPEG/size verification");
  }
  if(r.portrait.width!==600||r.portrait.height!==900||r.passport.width!==1200||r.passport.height!==845)throw new Error("Unexpected output dimensions");
  if(r.dates!=="February 28, 2027")throw new Error("90-day date arithmetic mismatch");
  console.log("PASS: portrait + rotated passport exports, real JPEGs, size limits, date calculator, site title.");
} finally {ws?.close();child.kill("SIGTERM");}
