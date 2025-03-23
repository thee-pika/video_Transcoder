import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import path from "node:path";
import Ffmpeg from "fluent-ffmpeg";
import fsOld from "node:fs";
import { config } from "dotenv";
import { v4 as uuidv4 } from "uuid";
config();


const Resolutions = [
  { name: "360p", width: 480, height: 360 },
  { name: "480p", width: 858, height: 480 },
  { name: "720p", width: 1200, height: 720 },
];

const s3Client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.BUCKET_NAME;
const KEY = process.env.KEY;
const videoId = process.env.VIDEO_ID;

async function init() {
  // Download the original video from s3
  console.log("key", KEY);
  console.log("BUCKET_NAME", KEY);
  console.log("videoId", videoId);

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: KEY,
  });

  const result = await s3Client.send(command);
  const originalFilePath = `original-video.mp4`;

  await fs.writeFile(originalFilePath, result.Body);
  const originalVideoPath = path.resolve(originalFilePath);

  // transcode into different formats
  // start the transcoder
  let videoIds = [];

  const promises = Resolutions.map((resolution) => {
    const rstring = uuidv4();
    const output = `${videoId}-${resolution.name}.mp4`;
    console.log("output", output);
    videoIds.push(output);
    console.log("videoIds", videoIds);
    return new Promise((resolve) => {
      Ffmpeg(originalVideoPath)
        .output(output)
        .withVideoCodec("libx264")
        .withAudioCodec("aac")
        .withSize(`${resolution.width}x${resolution.height}`)
        .on("end", async () => {
          console.log("output", output);
          const putCommand = new PutObjectCommand({
            Bucket: "transcoding-prod.learn",
            Key: output,
            Body: fsOld.createReadStream(path.resolve(output)),
          });

          await s3Client.send(putCommand);
          console.log("uploaded", output);
          resolve();
        })
        .format("mp4")
        .run();
    });
  });
  console.log("videoIds", videoIds);

  await Promise.all(promises);
}

init();
