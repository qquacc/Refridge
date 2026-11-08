import { rm, mkdir, cp } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("apps/main/dist", "dist", { recursive: true });
await cp("apps/camera/dist", "dist/camera", { recursive: true });
console.log(
  "Built main app at / and camera companion at /camera/. Start the backend with npm start.",
);
