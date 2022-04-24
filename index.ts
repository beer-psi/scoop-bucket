import handleiTunes from "./itunes.ts";
import { serve } from "https://deno.land/std@0.114.0/http/server.ts";

async function handler(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url)
  switch (pathname) {
    case '/itunes': {
      return await handleiTunes(request)
    }
  }
  return new Response(
    JSON.stringify({
      message: 'Need to specify an endpoint',
      endpoints: [
        "/itunes"
      ]
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      }
    }
  )
}

await serve(handler);
