// Simulates the exact server route pipeline: file → arrayBuffer → base64 → Anthropic API
// Usage: npx tsx scripts/test-pump-ocr.ts <path-to-image.jpg>
// Example: npx tsx scripts/test-pump-ocr.ts scripts/pump-test.jpg
import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { parseMeterText } from '../lib/ocr/parse-meter'

const imagePath = process.argv[2]
if (!imagePath) {
  console.error('Usage: npx tsx scripts/test-pump-ocr.ts <path-to-image>')
  process.exit(1)
}

const METER_PROMPT =
  'This is a photo of a fuel pump dispenser. List every number you can read in the image, one per line, digits only (no units, no labels). If you cannot read any numbers at all, return UNREADABLE.'

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1) }

  // Step 1: Read file (simulates file.arrayBuffer() in the route)
  const buf = fs.readFileSync(path.resolve(imagePath))
  console.log(`[1] File read: ${buf.length} bytes`)

  // Step 2: Base64 encode (identical to route)
  const base64 = buf.toString('base64')
  console.log(`[2] Base64 length: ${base64.length} chars`)
  if (base64.length === 0) { console.error('ERROR: base64 is empty!'); process.exit(1) }

  // Step 3: Call Anthropic (identical to callVision)
  const client = new Anthropic({ apiKey })
  console.log('[3] Calling Anthropic API...')
  let rawText: string
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 128,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: METER_PROMPT },
        ],
      }],
    })
    console.log('[3] API call succeeded')
    console.log('    content[0].type:', message.content[0]?.type)
    rawText = (message.content[0] as { type: 'text'; text: string }).text.trim()
    console.log('    raw text:', JSON.stringify(rawText))
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; error?: unknown }
    console.error('[3] API call FAILED')
    console.error('    status:', e.status)
    console.error('    message:', e.message)
    console.error('    error:', JSON.stringify(e.error))
    process.exit(1)
  }

  // Step 4: Parse (identical to parseMeterText)
  const result = parseMeterText(rawText)
  console.log('[4] parseMeterText result:', JSON.stringify(result))
}

main()
