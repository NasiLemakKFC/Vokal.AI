import { MongoClient, ServerApiVersion, type Db } from "mongodb";

const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
};

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let prodClientPromise: Promise<MongoClient> | undefined;
let indexesPromise: Promise<void> | undefined;

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "[MongoDB] MONGODB_URI is not defined in environment variables."
    );
  }

  if (process.env.NODE_ENV === "development") {
    if (!globalThis._mongoClientPromise) {
      const client = new MongoClient(uri, options);
      globalThis._mongoClientPromise = client.connect();
    }
    return globalThis._mongoClientPromise;
  }

  if (!prodClientPromise) {
    const client = new MongoClient(uri, options);
    prodClientPromise = client.connect();
  }
  return prodClientPromise;
}

function getDatabaseNameFromUri(uri: string): string {
  try {
    const match = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/i);
    const dbName = match?.[1]?.trim();
    return dbName || "interviewai";
  } catch {
    return "interviewai";
  }
}

export async function ensureIndexes(db: Db): Promise<void> {
  if (!indexesPromise) {
    indexesPromise = (async () => {
      await db.collection("practice_sessions").dropIndex("id_1").catch(() => {});
      await Promise.all([
        db.collection("users").createIndex({ email: 1 }, { unique: true }),
        db
          .collection("auth_sessions")
          .createIndex({ tokenHash: 1 }, { unique: true }),
        db
          .collection("auth_sessions")
          .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection("auth_sessions").createIndex({ userId: 1 }),
        db
          .collection("practice_sessions")
          .createIndex({ userId: 1, id: 1 }, { unique: true }),
        db
          .collection("practice_sessions")
          .createIndex({ userId: 1, completedAt: -1 }),
      ]);
    })().catch((err) => {
      indexesPromise = undefined;
      throw err;
    });
  }
  return indexesPromise;
}

export async function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "[MongoDB] MONGODB_URI is not defined in environment variables."
    );
  }
  const client = await getClientPromise();
  const db = client.db(getDatabaseNameFromUri(uri));
  await ensureIndexes(db);
  return db;
}
