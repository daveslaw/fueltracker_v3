import type { OcrResult } from './ocr-service'
import type { NozzlePosOcrResult } from './parse-nozzle-pos'
import type { DryStockLine } from './dry-stock-ocr'

export interface ImageRecogniser {
  extractMeterReading(imageBase64: string): Promise<OcrResult>
  extractPosLines(imageBase64: string): Promise<NozzlePosOcrResult>
  extractDryStockLines(imageBase64: string): Promise<DryStockLine[]>
}
