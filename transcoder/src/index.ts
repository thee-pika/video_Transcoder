import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import { config } from "dotenv";
import express from "express";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { S3Event } from "aws-lambda";
import { router } from "./router/router";
import cors from "cors";
config();

const sQSClient = new SQSClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const ecsClient = new ECSClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const input = {
  QueueUrl: process.env.SQS_QUEUE_URL,
  MaxNumberOfMessages: 1,
  WaitTimeSeconds: 20,
};

const command = new ReceiveMessageCommand(input);

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/v1/transcoder", router);

app.post("/start", (req, res) => {
  const {videoId} = req.body;
  console.log("videoId", videoId);

  res.send("started");
  init(videoId);
});

const init = async (videoId : string) => {
  try {
    console.log("started ...");
    const { Messages } = await sQSClient.send(command);
    console.log("messages", Messages);
    if (!Messages) {
      console.log("NO message in queue ");
      return;
    }

    for (const message of Messages) {
      const { MessageId, Body } = message;

      if (!Body) {
        continue;
      }
      const event = JSON.parse(Body);
      console.log("event", event);
      if ("Service" in event && "Event" in event) {

        if (event.Event === "s3:TestEvent") {
          await sQSClient.send(
            new DeleteMessageCommand({
              QueueUrl: process.env.SQS_QUEUE_URL,
              ReceiptHandle: message.ReceiptHandle,
            })
          );
          continue;
        }
      }

      for (const record of event.Records) {
        const { s3 } = record;
        const {
          bucket,
          object: { key },
        } = s3;

        const runTaskCommand = new RunTaskCommand({
          cluster: process.env.ECS_CLUSTER_ARN,
          launchType: "FARGATE",
          networkConfiguration: {
            awsvpcConfiguration: {
              assignPublicIp: "ENABLED",
              securityGroups: [process.env.ECS_SECURITY_GROUP!],
              subnets: process.env.ECS_SUBNETS!.split(","),
            },
          },
          overrides: {
            containerOverrides: [
              {
                name: "transcoder-image",
                environment: [
                  { name: "BUCKET_NAME", value: bucket.name },
                  { name: "KEY", value: key },
                  { name: "VIDEO_ID", value: videoId },
                ],
              },
            ],
          },
          taskDefinition: process.env.ECS_TASK_DEFINITION_ARN,
        });

        await ecsClient.send(runTaskCommand);

        // delete the message from sqs
        await sQSClient.send(
          new DeleteMessageCommand({
            QueueUrl: process.env.SQS_QUEUE_URL,
            ReceiptHandle: message.ReceiptHandle,
          })
        );

      }
    }
    // validate the event
    // spin the container
    // delete the message from queue
  } catch (error) {
    console.log("error", error);
  }
};

app.get("/", (req, res) => {
  res.send("Hello World");
});
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("server started at", PORT);
});
