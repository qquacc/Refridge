import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
export class FileStore {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, "sessions.json");
    this.queue = Promise.resolve();
  }
  async load() {
    try {
      return JSON.parse(await readFile(this.file, "utf8"));
    } catch (e) {
      if (e.code === "ENOENT") return { sessions: {} };
      throw e;
    }
  }
  async read() {
    await this.queue;
    return this.load();
  }
  mutate(fn) {
    const task = this.queue.then(async () => {
      await mkdir(this.directory, { recursive: true });
      const state = await this.load();
      const result = await fn(state);
      const temp = this.file + ".tmp";
      await writeFile(temp, JSON.stringify(state), { mode: 0o600 });
      await rename(temp, this.file);
      return result;
    });
    this.queue = task.catch(() => {});
    return task;
  }
}
