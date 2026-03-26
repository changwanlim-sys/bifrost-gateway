import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    // 1. Authentication (Bearer Token)
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing Bearer Token' }, { status: 401 });
    }
    const customerKey = authHeader.replace('Bearer ', '');

    // 2. Validate Key via Supabase RPC
    const { data: validKey, error: authErr } = await supabase.rpc('validate_api_key', { p_key: customerKey });
    
    if (authErr || !validKey || validKey.length === 0) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or inactive API Key' }, { status: 401 });
    }
    const apiKeyId = validKey[0].api_key_id;

    // 3. Parse Request Body
    const body = await req.json();
    const { model, messages, stream } = body;

    if (!model) {
      return NextResponse.json({ error: "Missing 'model' field" }, { status: 400 });
    }

    // 4. Route Provider
    let targetUrl = '';
    let providerHeaders: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const modelLow = model.toLowerCase();

    if (modelLow.startsWith('gpt') || modelLow.startsWith('o1') || modelLow.startsWith('dall-e')) {
      targetUrl = 'https://api.openai.com/v1/chat/completions';
      providerHeaders['Authorization'] = `Bearer ${process.env.OPENAI_API_KEY}`;
    } else if (modelLow.startsWith('gemini')) {
      targetUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
      providerHeaders['Authorization'] = `Bearer ${process.env.GEMINI_API_KEY}`;
    } else if (modelLow.startsWith('claude')) {
      // Anthropic Claude (Using OpenAI adapter URL if available, or native)
      targetUrl = 'https://api.anthropic.com/v1/messages';
      providerHeaders['x-api-key'] = process.env.ANTHROPIC_API_KEY || '';
      providerHeaders['anthropic-version'] = '2023-06-01';
    } else if (modelLow.startsWith('genspark')) {
      // Genspark Placeholder (Route to their API if they provide one)
      targetUrl = 'https://api.genspark.ai/v1/chat/completions'; // Placeholder URL
      providerHeaders['Authorization'] = `Bearer ${process.env.GENSPARK_API_KEY || ''}`;
    } else {
      return NextResponse.json({ error: 'Unsupported model provider' }, { status: 400 });
    }

    // 5. Proxy Request
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: providerHeaders,
      body: JSON.stringify(body)
    });

    const resData = await response.json();

    // 6. Log Usage Asynchronously
    // Standard OpenAI usage format: { usage: { prompt_tokens, completion_tokens } }
    // Anthropic uses { usage: { input_tokens, output_tokens } }
    let promptTokens = 0;
    let completionTokens = 0;

    if (response.ok) {
      if (resData.usage) {
        promptTokens = resData.usage.prompt_tokens || resData.usage.input_tokens || 0;
        completionTokens = resData.usage.completion_tokens || resData.usage.output_tokens || 0;
      }

      if (promptTokens > 0 || completionTokens > 0) {
        supabase.rpc('log_usage', {
          p_api_key_id: apiKeyId,
          p_model: model,
          p_prompt_tokens: promptTokens,
          p_completion_tokens: completionTokens
        }).then(({ error }) => {
          if (error) console.error('Usage logging failed:', error);
        });
      }
    }

    // 7. Return Provider Response
    return NextResponse.json(resData, { status: response.status });

  } catch (error: any) {
    console.error('Gateway Error:', error);
    return NextResponse.json({ error: 'Internal Gateway Error', details: error.message }, { status: 500 });
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
