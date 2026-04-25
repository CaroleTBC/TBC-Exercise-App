import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt, client_name } = await req.json();

    if (!prompt?.trim()) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

    const systemPrompt = `You are a physiotherapist writing patient education articles for Therapy by Carole, a specialist osteoporosis physiotherapy practice. Write clear, reassuring, evidence-based articles for patients.

Guidelines:
- Use plain, friendly language — avoid jargon
- Structure with ## headings, **bold** key terms, and - bullet points where helpful
- Be encouraging and practical
- Keep articles focused and concise (300–600 words unless specified)
- Categories available: General, Osteoporosis, Exercise Tips, Home Care, Nutrition, Lifestyle

Return ONLY valid JSON with these exact fields:
{
  "title": "Article title",
  "category": "One of the categories above",
  "content": "Full article in markdown format"
}`;

    const userMessage = client_name
      ? `Write a patient information article for ${client_name}. Topic: ${prompt}`
      : `Write a patient information article. Topic: ${prompt}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${err}`);
    }

    const data = await response.json();
    const text = data.content[0].text.trim();

    // Strip any markdown code fences if present
    const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    const article = JSON.parse(cleaned);

    return new Response(JSON.stringify({ article }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('generate-information error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Generation failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
