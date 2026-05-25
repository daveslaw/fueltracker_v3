import Anthropic from '@anthropic-ai/sdk'
import type { ImageRecogniser } from './image-recogniser'
import type { OcrResult } from './ocr-service'
import type { NozzlePosOcrResult } from './parse-nozzle-pos'
import type { DryStockLine } from './dry-stock-ocr'
import { parseMeterText } from './parse-meter'
import { parseNozzlePosText } from './parse-nozzle-pos'
import { parseDryStockOcrResponse } from './dry-stock-ocr'

const METER_PROMPT =
  'This is a photo of a fuel pump dispenser. List every number you can read in the image, one per line, digits only (no units, no labels). If you cannot read any numbers at all, return UNREADABLE.'

const POS_PROMPT = [
  'This is a fuel POS Z-report from a South African petrol station.',
  'Find the nozzle/pump sales section. For each nozzle line, output exactly:',
  'NOZZLE_NUMBER | RATE | LITRES_SOLD | REVENUE_ZAR',
  'NOZZLE_NUMBER is an integer. RATE, LITRES_SOLD, REVENUE_ZAR are decimals.',
  'Use NULL for any value you cannot read.',
  'Skip the totals row.',
  'If the image is completely unreadable, return only: UNREADABLE',
  'Do not include headers, explanations, or extra text.',
].join('\n')

const DRY_STOCK_PROMPT = [
  'This is a dry stock POS Z-report from a South African petrol station shop.',
  'List each product sales line in exactly this format, one per line:',
  'PRODUCT_NAME | UNITS_SOLD | REVENUE_ZAR',
  'Use NULL for any value you cannot read.',
  'If the image is completely unreadable, return only: UNREADABLE',
  'Do not include headers, explanations, or extra text.',
].join('\n')

export class AnthropicRecogniser implements ImageRecogniser {
  constructor(private client: Anthropic) {}

  async extractMeterReading(imageBase64: string): Promise<OcrResult> {
    const text = await this.callVision(imageBase64, METER_PROMPT, 128)
    return parseMeterText(text)
  }

  async extractPosLines(imageBase64: string): Promise<NozzlePosOcrResult> {
    const text = await this.callVision(imageBase64, POS_PROMPT, 512)
    return parseNozzlePosText(text)
  }

  async extractDryStockLines(imageBase64: string): Promise<DryStockLine[]> {
    const text = await this.callVision(imageBase64, DRY_STOCK_PROMPT, 1024)
    return parseDryStockOcrResponse(text)
  }

  private async callVision(imageBase64: string, prompt: string, maxTokens: number): Promise<string> {
    if (!imageBase64) {
      console.error('[OCR] callVision called with empty imageBase64')
      return 'UNREADABLE'
    }
    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: prompt },
          ],
        }],
      })
      const block = message.content[0]
      if (!block || block.type !== 'text') {
        console.error('[OCR] Unexpected response block type:', block?.type)
        return 'UNREADABLE'
      }
      return block.text.trim()
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err)
      console.error('[OCR] Anthropic API error:', msg)
      return 'UNREADABLE'
    }
  }
}
