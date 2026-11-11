import {computeLastDay, fitJpeg, isRealJpeg, outputDimensions} from "./core.js";
const $ = (id) => document.getElementById(id);
const canvas = $("preview"), ctx = canvas.getContext("2d", {alpha:false});
let mode = "portrait", image = null, imageUrl = null, zoom = 1, panX = 0, panY = 0, quarter = 0;
let currentDownloadUrl = null, pointerStart = null;
const format = (n) => n >= 1000000 ? (n / 1000000).toFixed(2) + " MB" : Math.round(n / 1000) + " KB";
function setStatus(msg, color = "#765c32") {
  $("status").textContent = msg;
  $("status").style.color = color;
}
function clearResult() {
  $("export-result").hidden = true;
  if(currentDownloadUrl) URL.revokeObjectURL(currentDownloadUrl);
  currentDownloadUrl = null;
}
function setMode(next) {
  mode = next;
  $("portrait-tab").classList.toggle("selected", mode === "portrait");
  $("passport-tab").classList.toggle("selected", mode === "passport");
  $("portrait-tab").setAttribute("aria-selected", String(mode === "portrait"));
  $("passport-tab").setAttribute("aria-selected", String(mode === "passport"));
  $("mode-info").textContent = mode === "portrait" ? "Vietnam · 2:3 ratio · JPEG" : "Vietnam · readable passport page · JPEG";
  $("size").innerHTML = mode === "portrait"
    ? '<option value="600x900">600 × 900 px — 2:3</option><option value="472x708">472 × 708 px — 2:3</option><option value="400x600">400 × 600 px — 2:3</option>'
    : '<option value="1200x845">1200 × 845 px — bio page</option><option value="1500x1056">1500 × 1056 px — more detail</option><option value="1000x704">1000 × 704 px — smaller file</option>';
  $("size-helper").textContent = mode === "portrait" ? "4 × 6 cm shape is a 2:3 aspect ratio. Pixels are adjustable." : "No fixed page ratio is claimed as an official requirement. Include every corner and the machine-readable lines.";
  $("guide-note").textContent = mode === "portrait" ? "Move image to frame your face" : "Keep the entire information page visible";
  dropImage();
}
function dropImage() {
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = null; image = null; zoom=1; panX=0; panY=0; quarter=0;
  $("zoom").value = "1"; $("zoom-value").textContent = "1.0×";
  $("empty-stage").hidden = false; $("canvas-stage").hidden = true;
  $("controls").hidden = true; $("replace-photo").hidden = true;
  $("export").disabled = true; $("source-meta").textContent = "Your files stay on your device.";
  $("image-input").value = "";
  clearResult(); setStatus("");
}
function getDims() { return outputDimensions(mode, $("size").value); }
function render(target, w, h, guides) {
  if (!image) return;
  target.canvas.width=w; target.canvas.height=h;
  target.setTransform(1,0,0,1,0,0);
  target.fillStyle="#fff"; target.fillRect(0,0,w,h);
  const imgW = image.naturalWidth, imgH = image.naturalHeight;
  const rotated = quarter % 2 !== 0, orientedW = rotated ? imgH : imgW, orientedH = rotated ? imgW : imgH;
  const scale = Math.max(w/orientedW,h/orientedH)*zoom*1.002;
  const spareX = Math.max(0,(orientedW*scale-w)/2), spareY = Math.max(0,(orientedH*scale-h)/2);
  target.save();
  target.translate(w/2 + panX*spareX,h/2 + panY*spareY);
  target.rotate(quarter*Math.PI/2);
  target.imageSmoothingEnabled = true; target.imageSmoothingQuality = "high";
  target.drawImage(image,-imgW*scale/2,-imgH*scale/2,imgW*scale,imgH*scale);
  target.restore();
  if (guides) {
    target.save();target.lineWidth=Math.max(1.4,w/300);target.strokeStyle="#f9fcf9ee";target.setLineDash([9,7]);
    if (mode === "portrait") {
      target.beginPath();target.ellipse(w/2,h*.43,w*.32,h*.28,0,0,2*Math.PI);target.stroke();
      target.beginPath();target.moveTo(0,h*.36);target.lineTo(w,h*.36);target.stroke();
    } else {
      target.strokeRect(w*.045,h*.055,w*.91,h*.89);
    }
    target.restore();
  }
}
function updatePreview() {
  if (!image) return;
  const [w,h] = getDims(), factor = Math.min(1,420/w,420/h);
  render(ctx,Math.max(160,Math.round(w*factor)),Math.max(160,Math.round(h*factor)),true);
  clearResult();
}
async function loadPhoto(file) {
  if (!file) return;
  if (!file.type.startsWith("image/") && !/\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name)) { setStatus("Please choose an image file."); return; }
  if (file.size > 60000000) { setStatus("Choose an image smaller than 60 MB."); return; }
  const url = URL.createObjectURL(file), candidate = new Image();
  try {
    candidate.src = url;
    await candidate.decode();
    if (!candidate.naturalWidth || !candidate.naturalHeight) throw new Error("The photo has no readable dimensions.");
  } catch(e) {
    URL.revokeObjectURL(url);
    setStatus(/heic|heif/i.test(file.name) ? "This browser could not open HEIC. Convert it to JPEG on your phone and try again." : "This image could not be decoded. Try JPEG or PNG.");
    return;
  }
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl=url;image=candidate;zoom=1;quarter=0;panX=0;panY=0;
  $("empty-stage").hidden = true; $("canvas-stage").hidden = false;
  $("controls").hidden = false; $("replace-photo").hidden = false;
  $("export").disabled=false;$("zoom").value="1";$("zoom-value").textContent="1.0×";
  $("source-meta").textContent = file.name + " · " + image.naturalWidth + " × " + image.naturalHeight + " · " + format(file.size);
  updatePreview();setStatus("Image loaded. Adjust the crop, then export.","#36795c");
}
function blobFrom(canvasElement, quality) {
  return new Promise((resolve,reject)=>canvasElement.toBlob(b=>b?resolve(b):reject(new Error("JPEG export failed.")),"image/jpeg",quality));
}
async function exportPhoto() {
  if (!image) return;
  $("export").disabled = true; $("export").textContent = "Preparing…";
  setStatus("");clearResult();
  try {
    let [w,h] = getDims(), limit = Number($("limit").value);
    let out = null, scaled = false;
    for (let attempt = 0; attempt < 7; attempt++) {
      const outCanvas = document.createElement("canvas");
      const outCtx=outCanvas.getContext("2d",{alpha:false});
      if (!outCtx) throw new Error("Canvas is unavailable.");
      render(outCtx,w,h,false);
      const fit = await fitJpeg((quality)=>blobFrom(outCanvas,quality),limit);
      if (fit.fits) { out=fit.blob;break; }
      w=Math.max(120,Math.floor(w*.78));
      h=Math.max(120,Math.round(h*.78));
      scaled=true;
    }
    if (!out) throw new Error("Could not fit your image under this size limit. Choose a larger maximum.");
    const bytes = new Uint8Array(await out.slice(0,3).arrayBuffer());
    if (!isRealJpeg(bytes) || out.type!=="image/jpeg" || out.size >= limit) throw new Error("Export verification failed.");
    const url=URL.createObjectURL(out), filename= "formfinish-vietnam-" + (mode==="portrait"?"portrait":"passport-page") + ".jpg";
    $("download").href=url; $("download").download=filename;
    currentDownloadUrl=url;
    $("result-meta").textContent=w+" × "+h+" px · "+format(out.size)+" · JPEG"+(scaled?" · resized to meet size limit":"");
    $("export-result").hidden=false;
    setStatus("Verified JPEG ready. Review the image visually before uploading.","#327e60");
  } catch(e) { setStatus(e instanceof Error?e.message:"Export error."); }
  finally { $("export").disabled=false;$("export").innerHTML='Export JPEG <span>↓</span>'; }
}
function refreshDates() {
  const n=Number($("days").value),result=computeLastDay($("arrival").value,n);
  if (result.error) { $("last-day").textContent="Check your dates";$("date-summary").textContent=result.error;return; }
  $("last-day").textContent=new Intl.DateTimeFormat("en-US",{timeZone:"UTC",day:"numeric",month:"long",year:"numeric"}).format(result.date);
  $("date-summary").textContent=String(n)+" calendar days · "+String(result.nights)+" nights · Arrival counts as day one.";
}
function refreshChecks() {
  const boxes=[...document.querySelectorAll("#check-grid input")];
  $("check-progress").textContent=boxes.filter(b=>b.checked).length+" / "+boxes.length+" checked";
}
$("portrait-tab").addEventListener("click",()=>setMode("portrait"));
$("passport-tab").addEventListener("click",()=>setMode("passport"));
$("image-input").addEventListener("change",e=>loadPhoto(e.target.files?.[0]));
$("replace-photo").addEventListener("click",()=>$("image-input").click());
$("size").addEventListener("change",updatePreview);
$("limit").addEventListener("change",clearResult);
$("zoom").addEventListener("input",e=>{zoom=Number(e.target.value);$("zoom-value").textContent=zoom.toFixed(2)+"×";updatePreview();});
$("rotate-left").addEventListener("click",()=>{quarter=(quarter+3)%4;updatePreview();});
$("rotate-right").addEventListener("click",()=>{quarter=(quarter+1)%4;updatePreview();});
$("reset-view").addEventListener("click",()=>{panX=0;panY=0;zoom=1;quarter=0;$("zoom").value=1;$("zoom-value").textContent="1.0×";updatePreview();});
$("export").addEventListener("click",exportPhoto);
$("arrival").addEventListener("input",refreshDates);
$("days").addEventListener("input",refreshDates);
document.querySelectorAll("#check-grid input").forEach(b=>b.addEventListener("change",refreshChecks));
$("preview").addEventListener("pointerdown",e=>{if(!image)return;pointerStart={x:e.clientX,y:e.clientY,panX,panY};canvas.setPointerCapture(e.pointerId);});
$("preview").addEventListener("pointermove",e=>{if(!pointerStart)return;const rect=canvas.getBoundingClientRect();panX=Math.max(-1,Math.min(1,pointerStart.panX+(e.clientX-pointerStart.x)/Math.max(50,rect.width)*2));panY=Math.max(-1,Math.min(1,pointerStart.panY+(e.clientY-pointerStart.y)/Math.max(50,rect.height)*2));updatePreview();});
for(const event of ["pointerup","pointercancel","lostpointercapture"])$("preview").addEventListener(event,()=>pointerStart=null);
$("preview").addEventListener("wheel",e=>{if(!image)return;e.preventDefault();zoom=Math.min(3,Math.max(1,zoom+(e.deltaY>0?-.08:.08)));$("zoom").value=String(zoom);$("zoom-value").textContent=zoom.toFixed(2)+"×";updatePreview();},{passive:false});
const zone=$("upload-zone");
zone.addEventListener("dragover",e=>{e.preventDefault();zone.classList.add("dragover");});
zone.addEventListener("dragleave",()=>zone.classList.remove("dragover"));
zone.addEventListener("drop",e=>{e.preventDefault();zone.classList.remove("dragover");loadPhoto(e.dataTransfer.files?.[0]);});
refreshDates();refreshChecks();
