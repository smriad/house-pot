#!/usr/bin/env node
/**
 * Build public/demo.mp4 slideshow from demo-screenshots + ElevenLabs voice.
 *   npm run demo:from-screenshots
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { loadEnvLocal, mediaDurationSec } from "./lib/demo-env.mjs";
import {
  buildTourAudioTrack,
  mergeVideoAndAudio,
  synthesizeSlideshowVoices,
} from "./lib/demo-voice.mjs";

loadEnvLocal();

const root = process.cwd();
const shotDir = path.join(root, "public", "demo-screenshots");
const outMp4 = path.join(root, "public", "demo.mp4");
const workDir = path.join(root, ".data", "demo-slideshow");
const voDir = path.join(root, ".data", "demo-slideshow-vo");

const ORDER = [
  { png: "01-kitchen-top.png", voiceId: "kitchen" },
  { png: "02-kitchen-form.png", voiceId: "form" },
  { png: "03-approved-recipe.png", voiceId: "recipe" },
  { png: "04-integrations-dashboard.png", voiceId: "integrations" },
  { png: "05-history-all.png", voiceId: "history_all" },
  { png: "06-household-history.png", voiceId: "history_household" },
];

const minSec = parseFloat(process.env.DEMO_SCREENSHOT_SEC ?? "2.5") || 2.5;
const padSec = 0.4;

const slides = ORDER.filter((s) => fs.existsSync(path.join(shotDir, s.png)));
if (!slides.length) {
  console.error("No PNGs in", shotDir, "— run npm run demo:screenshots");
  process.exit(1);
}

fs.mkdirSync(workDir, { recursive: true });
const voiceFiles = await synthesizeSlideshowVoices(voDir);

const durations = [];
const timeline = [];
let atSec = 0;

for (const slide of slides) {
  const voicePath = voiceFiles[slide.voiceId];
  if (!voicePath) {
    console.error("Missing voice for", slide.voiceId);
    process.exit(1);
  }
  const voiceSec = mediaDurationSec(voicePath);
  const holdSec = Math.max(minSec, voiceSec + padSec);
  durations.push(holdSec);
  timeline.push({ atSec, path: voicePath });
  atSec += holdSec;
}

const totalSec = atSec;
const segmentPaths = [];

for (let i = 0; i < slides.length; i++) {
  const src = path.join(shotDir, slides[i].png);
  const seg = path.join(workDir, `seg-${String(i + 1).padStart(2, "0")}.mp4`);
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-loop",
      "1",
      "-framerate",
      "25",
      "-i",
      src,
      "-vf",
      "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-t",
      String(durations[i]),
      seg,
    ],
    { stdio: "pipe" },
  );
  segmentPaths.push(seg);
}

const concatList = path.join(workDir, "video-concat.txt");
fs.writeFileSync(
  concatList,
  `${segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n")}\n`,
);

const silentMp4 = path.join(workDir, "silent.mp4");
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatList,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    silentMp4,
  ],
  { stdio: "inherit" },
);

const audioMp3 = path.join(workDir, "narration.mp3");
buildTourAudioTrack(timeline, totalSec, audioMp3);

const tempMp4 = path.join(workDir, "with-audio.mp4");
mergeVideoAndAudio(silentMp4, audioMp3, tempMp4);
fs.copyFileSync(tempMp4, outMp4);

console.log(
  `Wrote ${outMp4} (${slides.length} slides, ~${mediaDurationSec(outMp4).toFixed(1)}s, voice via ElevenLabs)`,
);
