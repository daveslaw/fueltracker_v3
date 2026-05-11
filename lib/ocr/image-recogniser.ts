import type { OcrResult, PosOcrResult } from './ocr-service'
import type { DryStockLine } from './dry-stock-ocr'

export interface ImageRecogniser {
  extractMeterReading(imageBase64: string): Promise<OcrResult>
  extractPosLines(imageBase64: string): Promise<PosOcrResult>
  extractDryStockLines(imageBase64: string): Promise<DryStockLine[]>
}
