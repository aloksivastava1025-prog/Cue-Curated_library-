#!/usr/bin/env node
// Cue MCP server — stdio transport.
// Exposes 4 tools: search_components, get_component, list_categories, list_tags.
// Backed by Cue's public Supabase project. Premium prompts + code
// gated behind CUE_API_KEY.

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import { searchComponents, searchComponentsSchema } from './tools/search.js'
import { getComponent, getComponentSchema } from './tools/get.js'
import { listCategories, listCategoriesSchema } from './tools/categories.js'
import { listTags, listTagsSchema } from './tools/tags.js'

const server = new Server(
  { name: 'cue', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

const TOOLS = [
  searchComponentsSchema,
  getComponentSchema,
  listCategoriesSchema,
  listTagsSchema,
]

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params
  try {
    let result: unknown
    switch (name) {
      case 'search_components':
        result = await searchComponents((args || {}) as any)
        break
      case 'get_component':
        result = await getComponent((args || {}) as any)
        break
      case 'list_categories':
        result = await listCategories()
        break
      case 'list_tags':
        result = await listTags()
        break
      default:
        throw new Error(`Unknown tool: ${name}`)
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  } catch (err: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error: ${err?.message || String(err)}`,
        },
      ],
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // eslint-disable-next-line no-console
  console.error('Cue MCP server ready (stdio).')
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Cue MCP fatal:', err)
  process.exit(1)
})
