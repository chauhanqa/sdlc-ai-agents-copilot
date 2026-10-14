import path from "node:path";
import { fileURLToPath } from "node:url";

export function resolveFrontendRoots(): {
  webRoot: string;
  distRoot: string;
} {
  const projectRoot = path.resolve(
    fileURLToPath(new URL("../../../", import.meta.url)),
  );
  const webRoot = path.join(projectRoot, "apps", "web");

  return {
    webRoot,
    distRoot: path.join(webRoot, "dist"),
  };
}
