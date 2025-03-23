import express from "express";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "dotenv";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
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

const sQSClient = new SQSClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const input = {
  QueueUrl: process.env.SQS_PROD_QUEUE_URL,
  MaxNumberOfMessages: 1,
  WaitTimeSeconds: 20,
};

const command = new ReceiveMessageCommand(input);

router.get("/check-status", async (req, res) => {
  console.log("some one hitted me!! check");
  let status = false;

  try {
    const { Messages } = await sQSClient.send(command);
    console.log("messages", Messages);

    if (!Messages) {
      console.log("NO message in queue ");
      res.json({ status });
      return;
    }

    for (const message of Messages) {
      const { Body } = message;

      if (!Body) continue;

      const event = JSON.parse(Body);
      console.log("eventtttttttttttttttttttttttttttttttt", event);

      if (event.Records && Array.isArray(event.Records)) {
        for (const record of event.Records) {
          console.log("Processing record:", record);

          if (record.eventName === "s3:TestEvent") {
            console.log("im hereeeeeeeeeeeeeeeeeeeeeeeeeeeeeee ....");
            await sQSClient.send(
              new DeleteMessageCommand({
                QueueUrl: process.env.SQS_PROD_QUEUE_URL!,
                ReceiptHandle: message.ReceiptHandle,
              })
            );
          } else {
            console.log("im hereeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee222222222222222222222");
            status = true;
          }
        }
      }
    }
  } catch (error) {
    console.error("Error processing SQS messages:", error);
  }

  res.json({ status });
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
