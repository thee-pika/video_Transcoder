import express from "express";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "dotenv";
import { v4 as uuidv4 } from "uuid";
config();

export const router = express();

const client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

router.get("/", (req, res) => {
  res.send("Hello from transcoder");
});

router.post("/upload-pre-signed-url", async (req, res) => {
  console.log("some one hitted me!!");

  const { name, type } = req.body;
  console.log("req.body", req.body);
  const videoId = "video-" + uuidv4();
  console.log("videoId", videoId);

  const command = new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME!,
    Key: name,
    ContentType: type,
  });

  const presignedUrl = await getSignedUrl(client, command, {
    expiresIn: 3600,
  });

  res.json({ url: presignedUrl, videoId });
});

router.post("/get-pre-signed-url", async (req, res) => {
  console.log("some one hitted me!! get");

  const { videoId } = req.body;
  console.log("req.body", req.body);
  console.log("videoId", videoId);

  const command = new GetObjectCommand({
    Bucket: process.env.PROD_BUCKET_NAME!,
    Key: videoId,
  });

  const presignedUrl = await getSignedUrl(client, command, {
    expiresIn: 3600,
  });

  res.json({ url: presignedUrl });
});
