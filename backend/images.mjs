import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
export class FileImages {
  constructor(directory) {
    this.directory = path.join(directory, "images");
  }
  async put(id, bytes) {
    await mkdir(this.directory, { recursive: true });
    await writeFile(path.join(this.directory, id + ".jpg"), bytes, {
      mode: 0o600,
    });
  }
  get(id) {
    return readFile(path.join(this.directory, id + ".jpg"));
  }
  async remove(id) {
    try {
      await unlink(path.join(this.directory, id + ".jpg"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
}
