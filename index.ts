import handleiTunes from './endpoints/itunes.ts';
import handleStore from './endpoints/msstore.ts';
import { serve } from 'https://deno.land/std@0.136.0/http/server.ts';

async function handler(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url)
  switch (pathname) {
    case '/itunes': {
      return await handleiTunes(request)
    }
    case '/store': {
      return await handleStore(request)
    }
  }
  return new Response(
    JSON.stringify({
      message: 'Need to specify an endpoint',
      endpoints: [
        '/itunes',
        '/store'
      ]
    }, null, 2),
    {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      }
    }
  )
}

await serve(handler);
