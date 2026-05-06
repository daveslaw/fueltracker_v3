// ── Types ─────────────────────────────────────────────────────────────────────

export type DryStockLine = {
  rawName: string
  unitsSold: number | null
  revenueZar: number | null
}

// ── Parser (pure) ─────────────────────────────────────────────────────────────

const HEADER_PATTERN = /^product\s*\|\s*units?\s*\|\s*revenue/i

/**
 * Pure function: parses Anthropic's text response into dry stock lines.
 * Expected format per line: "PRODUCT_NAME | UNITS_SOLD | REVENUE_ZAR"
 * Values may be NULL when the model cannot read them.
 * Returns empty array for UNREADABLE or unparseable responses.
 */
export function parseDryStockOcrResponse(text: string): DryStockLine[] {
  const trimmed = text.trim()
  if (!trimmed || trimmed.toUpperCase() === 'UNREADABLE') return []

  const lines: DryStockLine[] = []

  for (const raw of trimmed.split('\n')) {
    const parts = raw.split('|')
    if (parts.length < 3) continue

    const [namePart, unitsPart, revenuePart] = parts.map(p => p.trim())

    // Skip header rows
    if (HEADER_PATTERN.test(raw)) continue

    const rawName = namePart
    if (!rawName) continue

    const unitsSold = unitsPart.toUpperCase() === 'NULL'
      ? null
      : parseFloat(unitsPart)
    const revenueZar = revenuePart.toUpperCase() === 'NULL'
      ? null
      : parseFloat(revenuePart.replace(/[^0-9.]/g, ''))

    lines.push({
      rawName,
      unitsSold: unitsSold !== null && isNaN(unitsSold) ? null : unitsSold,
      revenueZar: revenueZar !== null && isNaN(revenueZar) ? null : revenueZar,
    })
  }

  return lines
}

// ── Anthropic API call ────────────────────────────────────────────────────────

/**
 * Calls Anthropic Vision on a dry stock Z-report image.
 * Returns structured product lines. Never throws.
 */
export async function extractDryStockLines(imageBase64: string): Promise<DryStockLine[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[OCR] ANTHROPIC_API_KEY not set — dry stock OCR unavailable')
    return []
  }

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const anthropic = new Anthropic()
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
          },
          {
            type: 'text',
            text: [
              'This is a dry stock POS Z-report from a South African petrol station shop.',
              'List each product sales line in exactly this format, one per line:',
              'PRODUCT_NAME | UNITS_SOLD | REVENUE_ZAR',
              'Use NULL for any value you cannot read.',
              'If the image is completely unreadable, return only: UNREADABLE',
              'Do not include headers, explanations, or extra text.',
            ].join('\n'),
          },
        ],
      }],
    })

    const responseText = (message.content[0] as { type: 'text'; text: string }).text.trim()
    return parseDryStockOcrResponse(responseText)
  } catch (err) {
    console.error('[OCR] Dry stock Anthropic error:', err)
    return []
  }
}
