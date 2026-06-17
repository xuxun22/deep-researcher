import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

const response = await client.messages.create({
  model: process.env.ANTHROPIC_MODEL || 'qwen3.7-plus',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'What is the weather in Beijing? Use the get_weather tool.' }
  ],
  tools: [{
    name: 'get_weather',
    description: 'Get weather for a city',
    input_schema: {
      type: 'object',
      properties: { city: { type: 'string' } },
      required: ['city']
    }
  }],
});

console.log('Stop reason:', response.stop_reason);
for (const block of response.content) {
  console.log('Block type:', block.type);
  if (block.type === 'tool_use') {
    console.log('  Tool name:', block.name);
    console.log('  Input:', JSON.stringify(block.input));
  } else if (block.type === 'text') {
    console.log('  Text:', block.text.substring(0, 150));
  }
}
