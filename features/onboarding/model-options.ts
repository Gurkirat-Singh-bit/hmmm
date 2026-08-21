export const speechModelsByProvider: Record<string, string[]> = {
  Deepgram: ['nova-3', 'nova-3-general', 'nova-3-medical', 'nova-2', 'nova-2-general', 'nova-2-meeting', 'enhanced', 'base'],
  Groq: ['whisper-large-v3', 'whisper-large-v3-turbo', 'distil-whisper-large-v3-en'],
};

export const aiModelsByProvider: Record<string, string[]> = {
  OpenRouter: [
    'google/gemini-2.5-flash',
    'anthropic/claude-sonnet-4',
    'openai/gpt-4.1',
    'openai/gpt-4.1-mini',
    'deepseek/deepseek-chat-v3-0324',
    'meta-llama/llama-4-maverick',
    'qwen/qwen3-235b-a22b',
  ],
  Groq: [
    'llama-3.3-70b-versatile',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
    'qwen/qwen3-32b',
    'deepseek-r1-distill-llama-70b',
  ],
  OpenAI: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'o3', 'o4-mini'],
};
