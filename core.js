// Dependency-free, locally testable calculation and output rules.
export function parseDay(text) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return ms;
}
export function computeLastDay(iso, days) {
  const start = parseDay(iso);
  if (start === null) return { error: "Enter a valid arrival date." };
  if (!Number.isInteger(days) || days < 1 || days > 90) return { error: "Stay must be 1–90 whole days." };
  const date = new Date(start + (days - 1) * 86400000);
  return { iso: date.toISOString().slice(0, 10), date, nights: days - 1 };
}
export function isRealJpeg(buffer) {
  return buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
}
export function outputDimensions(mode, selection) {
  const portrait = { "600x900": [600,900], "472x708": [472,708], "400x600": [400,600] };
  const passport = { "1200x845": [1200,845], "1500x1056": [1500,1056], "1000x704": [1000,704] };
  const table = mode === "passport" ? passport : portrait;
  return table[selection] || (mode === "passport" ? passport["1200x845"] : portrait["600x900"]);
}
// Search for the highest JPEG quality below the file limit. Caller provides canvas encoder.
export async function fitJpeg(encode, limit) {
  if (!Number.isFinite(limit) || limit < 1000) throw new Error("Invalid size limit.");
  const first = await encode(0.92);
  if (first.type !== "image/jpeg") throw new Error("Browser did not produce a JPEG.");
  if (first.size < limit) return { blob: first, quality: 0.92, fits: true };
  let best = null, low = 0.18, high = 0.92;
  for (let i = 0; i < 9; i++) {
    const mid = (low + high) / 2, blob = await encode(mid);
    if (blob.type !== "image/jpeg") throw new Error("Browser did not produce a JPEG.");
    if (blob.size < limit) { best = {blob,quality:mid,fits:true}; low = mid; }
    else high = mid;
  }
  if (best) return best;
  const blob = await encode(0.18);
  return { blob, quality: 0.18, fits: blob.size < limit };
}
