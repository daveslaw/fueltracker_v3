import Anthropic from '@anthropic-ai/sdk'
import type { ImageRecogniser } from './image-recogniser'
import type { OcrResult, PosOcrResult } from './ocr-service'
import type { DryStockLine } from './dry-stock-ocr'
import { parseMeterText } from './parse-meter'
import { parsePosText } from './parse-pos'
import { parseDryStockOcrResponse } from './dry-stock-ocr'

const METER_PROMPT =
  'This is a photo of a fuel pump dispenser. List every number you can read in the image, one per line, digits only (no units, no labels). If you cannot read any numbers at all, return UNREADABLE.'

const POS_PROMPT = [
  'This is a fuel POS Z-report from a South African petrol station.',
  'For each fuel grade line, output exactly: GRADE | LITRES_SOLD | REVENUE_ZAR',
  'Valid grade codes: 95, 93, D10, D50.',
  'Use NULL for any value you cannot read.',
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

  async extractPosLines(imageBase64: string): Promise<PosOcrResult> {
    const text = await this.callVision(imageBase64, POS_PROMPT, 512)
    return parsePosText(text)
  }

  async extractDryStockLines(imageBase64: string): Promise<DryStockLine[]> {
    const text = await this.callVision(imageBase64, DRY_STOCK_PROMPT, 1024)
    return parseDryStockOcrResponse(text)
  }

  private async callVision(imageBase64: string, prompt: string, maxTokens: number): Promise<string> {
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
      return (message.content[0] as { type: 'text'; text: string }).text.trim()
    } catch (err) {
      console.error('[OCR] Anthropic error:', err)
      return 'UNREADABLE'
    }
  }
}
