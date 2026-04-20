// supabase/functions/generate-exercise/index.ts
// Proxies AI exercise generation requests to Anthropic
// Deploy with: npx supabase functions deploy generate-exercise --no-verify-jwt
// Set secret with: npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

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
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `You are an expert in strength and conditioning, specialising in exercises for people with osteoporosis, bone health, and general rehabilitation. Generate an exercise based on this request: "${prompt}"

The exercise description must follow this exact structure:

First: A brief paragraph explaining what the exercise is and why it is beneficial for bone health. Do not mention clinical trial names.

Then on a new line: HOW TO DO IT:
Followed by numbered steps, one per line, each starting with the number and a full stop.

Then on a new line: SAFETY:
Followed by a single paragraph of safety guidance.

Also return the other fields as JSON. Return ONLY valid JSON in this exact format, no other text:
{
  "name": "Exercise Name",
  "category": "one of: strength, impact, spinal, balance",
  "description": "Brief intro paragraph.\\n\\nHOW TO DO IT:\\n1. First step.\\n2. Second step.\\n3. Third step.\\n4. Fourth step.\\n5. Fifth step.\\n6. Sixth step.\\n\\nSAFETY: Safety guidance paragraph.",
  "default_sets": 3,
  "default_reps": "10",
  "default_hold_seconds": null,
  "default_rest_seconds": 60,
  "therapist_notes_template": "Brief note about progressions, regressions, or contraindications for the therapist."
}`
        }],
      }),
    });

    if (!anthropicResponse.ok) {
      const error = await anthropicResponse.text();
      console.error('Anthropic API error:', error);
      return new Response(
        JSON.stringify({ error: 'AI generation failed', detail: error }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await anthropicResponse.json();
    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();

    // Validate it parses before sending back
    let generated;
    try {
      generated = JSON.parse(clean);
    } catch {
      console.error('JSON parse failed:', clean);
      return new Response(
        JSON.stringify({ error: 'AI returned invalid JSON', raw: clean }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ exercise: generated }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
