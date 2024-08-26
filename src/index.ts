import express, { Application, Request, Response } from "express";
import {
  RekognitionClient,
  CreateFaceLivenessSessionCommand,
  GetFaceLivenessSessionResultsCommand,
  Rekognition,
} from "@aws-sdk/client-rekognition";
import dotenv from "dotenv";
import cors from "cors";
import type { S3Object } from "@aws-sdk/client-rekognition";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const app: Application = express();
const port: number = 8080;
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID || "";
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || "";
const awsKmsKeyId = process.env.AWS_KMS_KEY_ID || "";
const collectionId = process.env.AWS_REKOGNITION_COLLECTION_ID || "";
const bucket = process.env.AWS_S3_BUCKET || "";
const region = process.env.AWS_REGION || "";

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json());

const client = new RekognitionClient({
  region,
  credentials: {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
  },
});

const rekognition = new Rekognition({});

const indexFaces = async (s3Object: S3Object | undefined, username: string) => {
  try {
    const response = await rekognition.indexFaces({
      CollectionId: collectionId,
      Image: {
        S3Object: s3Object,
      },
      ExternalImageId: username,
    });
    console.log("Faces indexed: ", response.FaceRecords, response);
    return response;
  } catch (error) {
    console.error("Error indexing faces: ", error);
    throw error;
  }
};

const searchFacesByImage = async (s3Object: S3Object | undefined) => {
  const params = {
    CollectionId: collectionId,
    Image: {
      S3Object: s3Object,
    },
  };
  try {
    const response = await rekognition.searchFacesByImage(params);
    console.log("Face matches: ", response.FaceMatches);
    return response;
  } catch (error) {
    console.error("Error searching faces: ", error);
    throw error;
  }
};

app.all("/", function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World with TypeScript!");
});

app.get("/faceLiveness/createSession", async (req: Request, res: Response) => {
  const clientRequestToken = uuidv4();
  const command = new CreateFaceLivenessSessionCommand({
    KmsKeyId: awsKmsKeyId,
    ClientRequestToken: clientRequestToken,
    Settings: {
      OutputConfig: {
        S3Bucket: bucket,
        S3KeyPrefix: "face-liveness",
      },
      AuditImagesLimit: 4,
    },
  });
  const response = await client.send(command);
  console.log("🚀 ~ app.get ~ response:", response);
  return res.json(response);
});

app.get(
  `/faceLiveness/getSessionResult/:sessionId`,
  async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId;
    const input = { SessionId: sessionId };
    const command = new GetFaceLivenessSessionResultsCommand(input);
    const response = await client.send(command);
    // indexFaces(response.ReferenceImage?.S3Object);
    searchFacesByImage(response.ReferenceImage?.S3Object);
    console.log(response);
    return res.json(response);
  }
);

app.get(
  `/faceLiveness/getSessionResult/:sessionId`,
  async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId;
    const input = { SessionId: sessionId };
    const command = new GetFaceLivenessSessionResultsCommand(input);
    const response = await client.send(command);
    console.log(response);
    return res.json(response);
  }
);

app.post(`/faceLiveness/indexFace`, async (req: Request, res: Response) => {
  const { bucket, name, version, username } = req.body;
  const s3Object: S3Object = {
    Bucket: bucket,
    Name: name,
    Version: version,
  };
  indexFaces(s3Object, username);
  return res.json({ message: "Face indexed successfully" });
});

app.post(`/faceLiveness/searchFace`, async (req: Request, res: Response) => {
  const { bucket, name, version } = req.body;
  const s3Object: S3Object = {
    Bucket: bucket,
    Name: name,
    Version: version,
  };
  const result = await searchFacesByImage(s3Object);
  const faceMatches = result.FaceMatches;
  return res.json({ faceMatches });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
