import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;
const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
};

let client;
let clientPromise;

if (!process.env.MONGODB_URI) {
  // Warn during build time or before .env.local is filled
  console.warn("[MongoDB] Warning: MONGODB_URI is not defined in environment variables.");
}

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so the MongoClient instance
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri || "", options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri || "", options);
  clientPromise = client.connect();
}

export default clientPromise;
