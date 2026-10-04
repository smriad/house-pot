#!/usr/bin/env node
/**
 * Append a screenshot slideshow to demo.mp4 (after main tour).
 *   npm run demo:splice-screenshots
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { mediaDurationSec } from "./lib/demo-env.mjs";

const root = process.cwd();
const shotDir = path.join(root, "public", "demo-screenshots");
const mainMp4 = path.join(root, "public", "demo.mp4");
const workDir = path.join(root, ".data", "demo-splice");

if (!fs.existsSync(mainMp4)) {
  console.error("Missing", mainMp4, "— run npm run demo:record first");
  process.exit(1);
}

const pngs = fs
  .readdirSync(shotDir)
  .filter((f) => f.endsWith(".png"))
  .sort();

if (!pngs.length) {
  console.error("No PNGs in", shotDir, "— run npm run demo:screenshots");
  process.exit(1);
}

fs.mkdirSync(workDir, { recursive: true });
const secPer = parseFloat(process.env.DEMO_SCREENSHOT_SEC ?? "2.5") || 2.5;
const reelMp4 = path.join(workDir, "screenshot-reel.mp4");
const mergedMp4 = path.join(workDir, "merged.mp4");
const glob = path.join(shotDir, "*.png");

execFileSync(
  "ffmpeg",
  [
    "-y",
    "-framerate",
    String(1 / secPer),
    "-pattern_type",
    "glob",
    "-i",
    glob,
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-vf",
    "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    reelMp4,
  ],
  { stdio: "inherit" },
);

execFileSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    mainMp4,
    "-i",
    reelMp4,
    "-filter_complex",
    "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[outv][outa]",
    "-map",
    "[outv]",
    "-map",
    "[outa]",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    mergedMp4,
  ],
  { stdio: "inherit" },
);

fs.copyFileSync(mergedMp4, mainMp4);
console.log(
  `Updated ${mainMp4} (+${(pngs.length * secPer).toFixed(1)}s, ${pngs.length} shots, total ~${mediaDurationSec(mainMp4).toFixed(1)}s)`,
);
