#!/usr/bin/env node
/**
 * Rebuild demo.mp4 audio from saved timeline + webm (no browser re-record).
 *   npm run demo:remix
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { mediaDurationSec } from "./lib/demo-env.mjs";
import { buildTourAudioTrack, mergeVideoAndAudio } from "./lib/demo-voice.mjs";

const root = process.cwd();
const dataDir = path.join(root, ".data");
const publicDir = path.join(root, "public");
const timelinePath = path.join(dataDir, "demo-timeline.json");
const webmPath = path.join(publicDir, "demo.webm");

if (!fs.existsSync(timelinePath)) {
  console.error("Missing", timelinePath, "— run npm run demo:record first");
  process.exit(1);
}
if (!fs.existsSync(webmPath)) {
  console.error("Missing", webmPath);
  process.exit(1);
}

const { timeline, videoSec, recipeAtSec } = JSON.parse(
  fs.readFileSync(timelinePath, "utf8"),
);

const tourTimeline = timeline.filter((t) => t.id !== "recipe-intro");
const tourOnlyMp3 = path.join(dataDir, "demo-tour-audio.mp3");
buildTourAudioTrack(
  tourTimeline.map((t) => ({ atSec: t.atSec, path: t.path })),
  videoSec,
  tourOnlyMp3,
);

const recipeIntro = timeline.find((t) => t.id === "recipe-intro");
const recipeIntroAt = recipeIntro?.atSec ?? recipeAtSec;
const recipeIntroPath = recipeIntro?.path ?? path.join(root, ".data", "demo-vo", "recipe.mp3");
const recipeMp3 = path.join(dataDir, "demo-narration.mp3");
const fullAudio = path.join(dataDir, "demo-full-audio.mp3");

const audioSegments = [{ atSec: 0, path: tourOnlyMp3 }];
if (fs.existsSync(recipeIntroPath)) {
  audioSegments.push({ atSec: recipeIntroAt, path: recipeIntroPath });
}
if (fs.existsSync(recipeMp3)) {
  audioSegments.push({
    atSec:
      recipeIntroAt +
      (fs.existsSync(recipeIntroPath) ? mediaDurationSec(recipeIntroPath) : 0) +
      0.4,
    path: recipeMp3,
  });
}

const audioTotal =
  videoSec + (fs.existsSync(recipeMp3) ? mediaDurationSec(recipeMp3) + 5 : 3);
buildTourAudioTrack(audioSegments, audioTotal, fullAudio);

const mp4Path = path.join(publicDir, "demo.mp4");
console.log("Remixing →", mp4Path);
mergeVideoAndAudio(webmPath, fullAudio, mp4Path);

const duration = execFileSync(
  "ffprobe",
  [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    mp4Path,
  ],
  { encoding: "utf8" },
).trim();
console.log(`Wrote ${mp4Path} (${duration}s)`);
