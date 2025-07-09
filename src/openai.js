import OpenAI from 'openai';
import { OPENAI_BASE_URL, OPENAI_API_KEY } from './config.js';

// Create OpenAI client
const openai = new OpenAI({
  baseURL: OPENAI_BASE_URL,
  apiKey: OPENAI_API_KEY,
});

export default openai; 