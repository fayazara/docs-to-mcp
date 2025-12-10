import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v3";

interface Env {
  AI: Ai;
  AI_SEARCH_NAME: string;
}

// Zod schema for AI Search response validation
const AiSearchResponseSchema = z.object({
  object: z.string(),
  search_query: z.string(),
  response: z.string().optional(),
  data: z.array(
    z.object({
      file_id: z.string(),
      filename: z.string(),
      score: z.number(),
      attributes: z
        .object({
          modified_date: z.number().optional(),
          folder: z.string().optional(),
        })
        .catchall(z.any()),
      content: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          text: z.string(),
        })
      ),
    })
  ),
  has_more: z.boolean(),
  next_page: z.string().nullable(),
});

export default {
  fetch: async (req: Request, env: Env, ctx: ExecutionContext) => {
    const url = new URL(req.url);

    // Streamable HTTP transport
    if (url.pathname === "/mcp") {
      const server = createMcpServer(env);
      const mcpHandler = createMcpHandler(server);
      return mcpHandler(req, env, ctx);
    }

    // Health check / info
    if (url.pathname === "/") {
      return new Response(
        JSON.stringify({
          name: "docs-to-mcp",
          description: "MCP server for AI Search",
          ai_search: env.AI_SEARCH_NAME,
          endpoint: "/mcp",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response("Not found", { status: 404 });
  },
};

function createMcpServer(env: Env): McpServer {
  const server = new McpServer({
    name: "docs-to-mcp",
    version: "0.1.0",
  });

  // @ts-ignore - excessive type depth from zod/mcp-sdk interaction
  server.tool(
    "search_docs",
    `Search the documentation using AI Search.
		
Returns semantically similar chunks from the indexed documents.
Use this tool to find relevant information from the documentation.`,
    {
      query: z.string().describe("The search query"),
      max_results: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe("Maximum number of results (1-50, default 10)"),
      rewrite_query: z
        .boolean()
        .optional()
        .describe("Rewrite query for better retrieval (default false)"),
      score_threshold: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Minimum score threshold (0-1, default 0)"),
    },
    {
      title: "Search Documentation",
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ query, max_results, rewrite_query, score_threshold }) => {
      const results = await queryAiSearch(env, query, {
        maxResults: max_results,
        rewriteQuery: rewrite_query,
        scoreThreshold: score_threshold,
      });

      const resultsAsXml = results
        .map(
          (result) => `<result>
<filename>${result.filename}</filename>
<score>${result.score}</score>
<text>
${result.text}
</text>
</result>`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text:
              resultsAsXml ||
              "<no_results>No matching documents found.</no_results>",
          },
        ],
      };
    }
  );

  return server;
}

interface SearchOptions {
  maxResults?: number;
  rewriteQuery?: boolean;
  scoreThreshold?: number;
}

async function queryAiSearch(
  env: Env,
  query: string,
  options: SearchOptions = {}
) {
  const rawResponse = await doWithRetries(() =>
    env.AI.autorag(env.AI_SEARCH_NAME).search({
      query,
      max_num_results: options.maxResults ?? 10,
      rewrite_query: options.rewriteQuery ?? false,
      ranking_options: {
        score_threshold: options.scoreThreshold ?? 0,
      },
    })
  );

  const response = AiSearchResponseSchema.parse(rawResponse);

  return response.data.map((item) => ({
    fileId: item.file_id,
    filename: item.filename,
    score: item.score,
    text: item.content.map((c) => c.text).join("\n"),
    attributes: item.attributes,
  }));
}


async function doWithRetries<T>(
  action: () => Promise<T>,
  retries = 5
): Promise<T> {
  const INIT_RETRY_MS = 100;

  for (let i = 0; i <= retries; i++) {
    try {
      return await action();
    } catch (e) {
      console.error(`AI Search attempt ${i + 1} failed:`, e);

      if (i === retries || !isRetryableError(e)) {
        throw e;
      }

      const delay = Math.random() * INIT_RETRY_MS * Math.pow(2, i);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Unexpected error in retry loop");
}

function isRetryableError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status;
    return status >= 500 || status === 429;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("timeout") ||
      msg.includes("network") ||
      msg.includes("connection")
    );
  }

  return true;
}
