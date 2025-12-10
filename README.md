# docs-to-mcp

A Cloudflare Worker that turns any AI Search (AutoRAG) instance into an MCP server.

## Setup

1. **Create an AI Search instance** in the Cloudflare dashboard
   - Create a R2 bucket and upload all your docs files - markdown, pdfs, text files etc.
   - Go to Computer & AI > AI Search(AutorRAG)
   - Create a new AI Search instance and select the R2 bucket as source (the one you previously created), just select the defaults.

2. **Configure the Worker**

   Update `wrangler.jsonc` with your AI Search name:

   ```jsonc
   "vars": {
     "AI_SEARCH_NAME": "your-ai-search-name"
   }
   ```

3. **Install dependencies**

   ```bash
   pnpm install
   ```

4. **Deploy**
   ```bash
   pnpm run deploy
   ```

## Usage

### MCP Endpoints

| Endpoint | Transport       | Description                  |
| -------- | --------------- | ---------------------------- |
| `/mcp`   | Streamable HTTP | Standard MCP HTTP transport  |

### How did I test this.

I trained it on a fictional TypeScript framework with APIs named after my cat, Ustaad, so I would know it's not hallucinating, you can find these files in fake-knowledge.md

### Available Tools

#### `search_docs`

Search the documentation and return relevant chunks.

Parameters:

- `query` (required): The search query
- `max_results` (optional): Maximum results (1-50, default 10)
- `rewrite_query` (optional): Rewrite query for better retrieval
- `score_threshold` (optional): Minimum score threshold (0-1)

#### `ai_search_docs`

Search documentation and get an AI-generated response with sources.

Parameters: Same as `search_docs`

### Connect from MCP Clients

**Claude Desktop / Cursor / etc:**

```json
{
  "mcpServers": {
    "docs": {
      "command": "npx",
      "args": ["mcp-remote", "https://your-worker.workers.dev/mcp"]
    }
  }
}
```

**Direct remote MCP (if client supports it):**

```
https://your-worker.workers.dev/mcp
```

## Local Development

```bash
npm run dev
```