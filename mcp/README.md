# @cue/mcp

Cue MCP server — Awwwards-tier UI components with prompts + React source, callable from Cursor, Claude Desktop, Windsurf, or any MCP-compatible AI tool.

Ask your AI: *"Cue, give me a scroll-pinned hero for a fintech SaaS"* — the MCP searches [cuedesign.space](https://cuedesign.space), returns the best match, and hands your model the prompt (and code, if you're Cue+).

## Install

Add to your `mcp.json` (Cursor / Windsurf) or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cue": {
      "command": "npx",
      "args": ["-y", "@cue/mcp@latest"],
      "env": {
        "CUE_API_KEY": "cue_live_xxxxxxxxxxxx"
      }
    }
  }
}
```

Free tier works without `CUE_API_KEY` — you get metadata + all free-tier prompts. Paying members paste their key from [cuedesign.space/#/account](https://cuedesign.space/#/account) to unlock premium prompts + React source.

## Tools

| Tool | Purpose |
|---|---|
| `search_components` | Search by keyword, tag, category, tier. Returns metadata only. |
| `get_component` | Fetch a single component's prompt + source. Premium fields gated by API key. |
| `list_categories` | Discover the taxonomy. |
| `list_tags` | Discover canonical tags. |

## Local dev

```bash
cd mcp
npm install
npm run build
node dist/index.js  # smoke test
```

Point Claude Desktop at your local build:

```json
{
  "mcpServers": {
    "cue": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/dist/index.js"]
    }
  }
}
```

## License

MIT © Cue
