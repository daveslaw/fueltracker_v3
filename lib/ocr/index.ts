import Anthropic from '@anthropic-ai/sdk'
import { AnthropicRecogniser } from './anthropic-recogniser'
import type { ImageRecogniser } from './image-recogniser'

export const recogniser: ImageRecogniser = new AnthropicRecogniser(new Anthropic())
