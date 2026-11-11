import test from "node:test";import assert from "node:assert/strict";import {parseDay,computeLastDay,outputDimensions,fitJpeg,isRealJpeg} from "../core.js";
test("strict date handling",()=>{assert.equal(parseDay("2026-02-29"),null);assert.ok(parseDay("2028-02-29"));assert.equal(parseDay("not-a-date"),null);});
test("inclusive 90 day stay",()=>{assert.equal(computeLastDay("2026-12-01",90).iso,"2027-02-28");assert.equal(computeLastDay("2026-12-01",1).iso,"2026-12-01");assert.equal(computeLastDay("2026-12-01",91).error,"Stay must be 1–90 whole days.");});
test("DST-independent date arithmetic",()=>{assert.equal(computeLastDay("2027-03-12",5).iso,"2027-03-16");});
test("portrait aspect ratio presets",()=>{for(const p of ["600x900","472x708","400x600"]){const [w,h]=outputDimensions("portrait",p);assert.equal(w/h,2/3);}});
test("passport size preset",()=>{assert.deepEqual(outputDimensions("passport","1200x845"),[1200,845]);});
test("JPEG magic bytes",()=>{assert.equal(isRealJpeg(Uint8Array.from([255,216,255,224])),true);assert.equal(isRealJpeg(Uint8Array.from([137,80,78,71])),false);});
test("JPEG quality search hits size",async()=>{let calls=0;const result=await fitJpeg(async q=>{calls++;return {type:"image/jpeg",size:Math.floor(q*200000)};},100000);assert.equal(result.fits,true);assert.ok(result.blob.size<100000);assert.ok(calls>1);});
test("reject bad JPEG mime",async()=>{await assert.rejects(()=>fitJpeg(async()=>({type:"image/png",size:200}),1000),/JPEG/);});
