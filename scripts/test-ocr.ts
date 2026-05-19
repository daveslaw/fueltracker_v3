// Quick OCR diagnostic — run with: npx tsx scripts/test-ocr.ts
import Anthropic from '@anthropic-ai/sdk'

// Minimal 1x1 white JPEG in base64 (known-good test image)
const TINY_JPEG =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k='

async function main() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  console.log('Testing Anthropic API connectivity...')

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 128,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: TINY_JPEG } },
          { type: 'text', text: 'List every number you can read in the image, one per line, digits only. If you cannot read any numbers, return UNREADABLE.' },
        ],
      }],
    })
    console.log('SUCCESS. Response content[0] type:', message.content[0]?.type)
    const text = (message.content[0] as { type: 'text'; text: string }).text
    console.log('Response text:', JSON.stringify(text))
    console.log('Stop reason:', message.stop_reason)
  } catch (err: unknown) {
    console.error('ERROR:', err)
    if (err && typeof err === 'object' && 'status' in err) {
      console.error('HTTP status:', (err as { status: number }).status)
    }
    if (err && typeof err === 'object' && 'error' in err) {
      console.error('API error:', JSON.stringify((err as { error: unknown }).error, null, 2))
    }
  }
}

main()
