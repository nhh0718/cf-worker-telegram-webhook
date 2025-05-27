const TELEGRAM_API_BASE = 'https://api.telegram.org';
const BACKEND_WEBHOOK_URL = '{{backend_url}}/api/telegram/webhook';

const DOC_HTML = `<!DOCTYPE html>
<html>
<head>
    <title>Telegram Bot API Proxy Documentation</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1 { color: #0088cc; }
        .code {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            font-family: monospace;
            overflow-x: auto;
        }
        .note {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
        }
        .example {
            background: #e7f5ff;
            border-left: 4px solid #0088cc;
            padding: 15px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <h1>Telegram Bot API Proxy</h1>
    <p>This service acts as a transparent proxy for the Telegram Bot API and a webhook receiver for Telegram updates.</p>

    <h2>Usage</h2>
    <div class="example">
        <h3>Telegram API Proxy:</h3>
        <div class="code">https://{YOUR_WORKER_URL}/bot{YOUR_BOT_TOKEN}/sendMessage</div>
        <h3>Telegram Webhook Endpoint:</h3>
        <div class="code">https://{YOUR_WORKER_URL}/webhook</div>
    </div>
</body>
</html>`;

addEventListener('fetch', event => {
  const request = event.request;

  if (request.method === 'OPTIONS') {
    event.respondWith(handleOptions());
  } else {
    event.respondWith(handleRequest(request));
  }
});

function handleOptions() {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  return new Response(null, { status: 204, headers: corsHeaders });
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  console.log(pathname);
  // 🧩 1. Handle Telegram webhook
  if (request.method === 'POST' && pathname === '/webhook') {
    try {
      const rawBody = await request.text();
      await fetch(BACKEND_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': request.headers.get('Content-Type') || 'application/json',
        },
        body: rawBody,
      });
      return new Response('Webhook received and forwarded', { status: 200 });
    } catch (err) {
      return new Response('Error forwarding webhook', { status: 200 });
    }
  }

  // 🧩 2. Serve documentation
  if (pathname === '/' || pathname === '') {
    return new Response(DOC_HTML, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // 🧩 3. Proxy to Telegram API
  const pathParts = pathname.split('/').filter(Boolean);
  if (pathParts.length < 2 || !pathParts[0].startsWith('bot')) {
    return new Response('Invalid bot request format', { status: 400 });
  }

  const telegramUrl = `${TELEGRAM_API_BASE}${pathname}${url.search}`;
  const proxyRequest = new Request(telegramUrl, {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' ? await request.arrayBuffer() : undefined,
    redirect: 'follow',
  });

  try {
    const telegramResponse = await fetch(proxyRequest);
    const responseBody = await telegramResponse.arrayBuffer();

    const responseHeaders = new Headers(telegramResponse.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type');

    return new Response(responseBody, {
      status: telegramResponse.status,
      statusText: telegramResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(`Error proxying request: ${error.message}`, { status: 500 });
  }
}
