// supabase/functions/generate-article/index.ts
// Generates patient information articles via Anthropic
// Deploy: npx supabase functions deploy generate-article --no-verify-jwt
// Uses the same ANTHROPIC_API_KEY secret as generate-exercise

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
    const { prompt, category } = await req.json();

    if (!prompt?.trim()) {
      return new Response(
        JSON.stringify({ error: 'No prompt provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `You are writing patient information for a physiotherapy and massage therapy practice specialising in bone health, osteoporosis, and rehabilitation. The therapist is Carole Andrews, based in Scotland.

Write a clear, warm, accessible information article based on this request: "${prompt}"
Category: ${category || 'General'}

Guidelines:
- Write for a patient audience — clear, plain English, no jargon without explanation
- Warm and encouraging tone, not clinical or frightening
- Use markdown formatting: ## for main headings, ### for subheadings, **bold** for key terms, - for bullet points
- Structure: brief intro paragraph, then sections with headings, finish with a practical takeaway
- Length: 300-500 words
- Do not mention specific medications or dosages
- Do not include anything that requires personal clinical assessment — keep it general and educational

Return ONLY valid JSON, no other text:
{
  "title": "Article Title",
  "category": "${category || 'General'}",
  "content": "Full markdown content here"
}`
        }],
      }),
    });

    if (!anthropicResponse.ok) {
      const error = await anthropicResponse.text();
      return new Response(
        JSON.stringify({ error: 'AI generation failed', detail: error }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await anthropicResponse.json();
    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let generated;
    try {
      generated = JSON.parse(clean);
    } catch {
      return new Response(
        JSON.stringify({ error: 'AI returned invalid JSON', raw: clean }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ article: generated }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
