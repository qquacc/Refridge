import { serialize, deserialize } from "node:v8";
const copy = (v) => (v === undefined ? undefined : deserialize(serialize(v)));
export function fakeMongo() {
  const shared = { maps: new Map(), tail: Promise.resolve() };
  function client() {
    return {
      db() {
        return {
          async createCollection(name) {
            if (shared.maps.has(name)) {
              const e = Error("Exists");
              e.code = 48;
              throw e;
            }
            shared.maps.set(name, new Map());
          },
          collection(name) {
            const map = (options) => {
              const maps = options?.session?.maps || shared.maps;
              if (!maps.has(name)) maps.set(name, new Map());
              return maps.get(name);
            };
            return {
              async findOne(filter, options) {
                return copy(map(options).get(filter._id));
              },
              async updateOne(filter, update, options) {
                const rows = map(options);
                if (!rows.has(filter._id) && options?.upsert)
                  rows.set(
                    filter._id,
                    copy({ _id: filter._id, ...update.$setOnInsert }),
                  );
                return { acknowledged: true };
              },
              async replaceOne(filter, value, options) {
                map(options).set(filter._id, copy(value));
                return { matchedCount: 1 };
              },
              async deleteOne(filter, options) {
                return {
                  deletedCount: map(options).delete(filter._id) ? 1 : 0,
                };
              },
            };
          },
        };
      },
      startSession() {
        return {
          async withTransaction(fn) {
            const run = shared.tail.then(async () => {
              this.maps = copy(shared.maps);
              try {
                const result = await fn();
                shared.maps = this.maps;
                return result;
              } finally {
                this.maps = null;
              }
            });
            shared.tail = run.catch(() => {});
            return run;
          },
          async endSession() {},
        };
      },
    };
  }
  return { client, shared };
}
