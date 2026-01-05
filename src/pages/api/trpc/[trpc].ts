import { createNextApiHandler } from "@trpc/server/adapters/next";
import type { NextApiRequest, NextApiResponse } from "next";

import { env } from "@/env";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";

// Increase body size limit for large PDF uploads (default is 1MB)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "15mb",
    },
  },
};

// Create the tRPC handler
const handler = createNextApiHandler({
  router: appRouter,
  createContext: createTRPCContext,
  onError:
    env.NODE_ENV === "development"
      ? ({ path, error }) => {
          console.error(
            `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
          );
        }
      : undefined,
});

// export API handler
export default function trpcHandler(req: NextApiRequest, res: NextApiResponse) {
  return handler(req, res);
}
