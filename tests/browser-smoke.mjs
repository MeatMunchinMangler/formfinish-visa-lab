import {spawn} from "node:child_process";
const chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const args=["--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check","--disable-extensions","--remote-debugging-port=18766","--user-data-dir=/tmp/formfinish-cdp-smoke","http://127.0.0.1:18765/"];
const child=spawn(chrome,args,{stdio:"ignore"});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
let ws;
try {
  let tabs;
  for(let i=0;i<25;i++) {
    try { tabs=await fetch("http://127.0.0.1:18766/json/list").then(r=>r.json()); if(tabs?.some(x=>x.type==="page"))break; } catch {}
    await sleep(250);
  }
  const page=tabs?.find(x=>x.type==="page");
  if(!page)throw new Error("Chrome DevTools page never started.");
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let seq=0;
  const pending=new Map();
  ws.onmessage=(event)=>{const msg=JSON.parse(event.data);if(msg.id&&pending.has(msg.id)){const {resolve,reject}=pending.get(msg.id);pending.delete(msg.id);msg.error?reject(new Error(JSON.stringify(msg.error))):resolve(msg.result);}};
  function call(method,params={}) {
    const id=++seq;
    return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  }
  await call("Runtime.enable");
  const expr = `(async()=> {
    const canvas=document.createElement("canvas");canvas.width=800;canvas.height=1200;
    const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,800,1200);
    ctx.fillStyle="#234";ctx.fillRect(220,140,360,850);
    const synthetic=await new Promise(r=>canvas.toBlob(r,"image/png"));
    const input=document.querySelector("#image-input");
    const dt=new DataTransfer();dt.items.add(new File([synthetic],"synthetic.png",{type:"image/png"}));input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));
    for(let i=0;i<40 && document.querySelector("#export").disabled;i++)await new Promise(r=>setTimeout(r,100));
    if(document.querySelector("#export").disabled)return {error:"Image load failed",status:document.querySelector("#status").textContent};
    document.querySelector("#limit").value="49000";document.querySelector("#export").click();
    for(let i=0;i<80 && document.querySelector("#export-result").hidden;i++)await new Promise(r=>setTimeout(r,100));
    if(document.querySelector("#export-result").hidden)return {error:"Export failed",status:document.querySelector("#status").textContent};
    const link=document.querySelector("#download");
    const blob=await fetch(link.href).then(r=>r.blob());
    const magic=new Uint8Array(await blob.slice(0,3).arrayBuffer());
    const bm=await createImageBitmap(blob);
    const result={filename:link.download,size:blob.size,mime:blob.type,width:bm.width,height:bm.height,magic:[...magic],status:document.querySelector("#status").textContent};
    bm.close();return result;
  })()`;
  const out=await call("Runtime.evaluate",{expression:expr,awaitPromise:true,returnByValue:true});
  const value=out.result?.value;
  console.log("Browser export result:",JSON.stringify(value));
  if(out.exceptionDetails||value?.error||!value||value.mime!=="image/jpeg"||value.size>=49000||value.magic?.[0]!==255||value.magic?.[1]!==216)throw new Error("Browser export smoke test failed.");
  console.log("PASS: upload → crop → compress (<49KB) → verified JPEG download.");
} finally {
  ws?.close();
  child.kill("SIGTERM");
}
