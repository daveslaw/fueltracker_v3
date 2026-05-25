import type { ImageRecogniser } from './image-recogniser'
import type { OcrResult } from './ocr-service'
import type { NozzlePosOcrResult } from './parse-nozzle-pos'
import type { DryStockLine } from './dry-stock-ocr'

export class FakeRecogniser implements ImageRecogniser {
  meterResult: OcrResult = { value: null, confidence: 0, status: 'unreadable' }
  posResult: NozzlePosOcrResult = { lines: [], raw_text: '', status: 'unreadable' }
  dryStockResult: DryStockLine[] = []

  async extractMeterReading(_imageBase64: string): Promise<OcrResult> {
    return this.meterResult
  }

  async extractPosLines(_imageBase64: string): Promise<NozzlePosOcrResult> {
    return this.posResult
  }

  async extractDryStockLines(_imageBase64: string): Promise<DryStockLine[]> {
    return this.dryStockResult
  }
}
