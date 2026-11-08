import { AsyncLocalStorage } from "node:async_hooks";
import { MongoClient, BSON } from "mongodb";
const connections = new Map();
/** One small application-state document preserves the prototype's existing transactions.
 * Photos live in separate binary documents, never in the state document. */
export class MongoStore {
  constructor({ client, database = "fridgeful" }) {
    this.client = client;
    this.db = client.db(database);
    this.state = this.db.collection("application_state");
    this.photos = this.db.collection("camera_images");
    this.transaction = new AsyncLocalStorage();
  }
  async initialize() {
    await this.db.createCollection("camera_images").catch((e) => {
      if (e.code !== 48) throw e;
    });
    await this.state
      .updateOne(
        { _id: "state" },
        { $setOnInsert: { value: { sessions: {} } } },
        { upsert: true },
      )
      .catch((e) => {
        if (e.code !== 11000) throw e;
      });
    return this;
  }
  async read() {
    const doc = await this.state.findOne({ _id: "state" }, this.options());
    return doc?.value || { sessions: {} };
  }
  options() {
    const session = this.transaction.getStore();
    return session ? { session } : {};
  }
  async mutate(fn) {
    const session = this.client.startSession();
    try {
      return await session.withTransaction(
        () =>
          this.transaction.run(session, async () => {
            const value = await this.read();
            const result = await fn(value);
            if (BSON.calculateObjectSize({ value }) > 14 * 1024 * 1024) {
              const e = Error(
                "Prototype metadata capacity reached. Delete old sessions/events before adding more.",
              );
              e.status = 409;
              throw e;
            }
            await this.state.replaceOne(
              { _id: "state" },
              { _id: "state", value },
              { session },
            );
            return result;
          }),
        {
          readConcern: { level: "snapshot" },
          writeConcern: { w: "majority" },
          maxCommitTimeMS: 5000,
          timeoutMS: 10000,
        },
      );
    } finally {
      await session.endSession();
    }
  }
  get images() {
    return {
      put: async (id, bytes) => {
        await this.photos.updateOne(
          { _id: id },
          {
            $setOnInsert: { bytes: Buffer.from(bytes), createdAt: new Date() },
          },
          { ...this.options(), upsert: true },
        );
      },
      get: async (id) => {
        const doc = await this.photos.findOne(
          { _id: id },
          { ...this.options(), promoteBuffers: true },
        );
        if (!doc) {
          const e = Error("Image not found.");
          e.status = 404;
          throw e;
        }
        return Buffer.from(
          doc.bytes.buffer && !Buffer.isBuffer(doc.bytes)
            ? doc.bytes.buffer
            : doc.bytes,
        );
      },
      remove: async (id) => {
        await this.photos.deleteOne({ _id: id }, this.options());
      },
    };
  }
}
export function getMongoStore({
  uri = process.env.MONGODB_URI,
  database = process.env.MONGODB_DB || "fridgeful",
} = {}) {
  if (!uri) {
    const e = Error(
      "Set MONGODB_URI in the server environment before using the hosted API.",
    );
    e.status = 503;
    throw e;
  }
  const key = uri + "\n" + database;
  if (!connections.has(key)) {
    const client = new MongoClient(uri, {
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 10000,
      serverSelectionTimeoutMS: 8000,
      waitQueueTimeoutMS: 5000,
    });
    const promise = client
      .connect()
      .then(() => new MongoStore({ client, database }).initialize())
      .catch(async (error) => {
        connections.delete(key);
        await client.close().catch(() => {});
        throw error;
      });
    connections.set(key, promise);
  }
  return connections.get(key);
}
