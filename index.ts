import * as servest from "https://deno.land/x/servest@v1.3.1/mod.ts";
import handleiTunes from "./itunes.ts";

async function handler(request: servest.ServerRequest): Promise<void> {
  return await request.respond({
    status: 200,
    headers: new Headers({
      'content-type': 'application/json; charset=utf-8',
    }),
    body: JSON.stringify({
      message: 'Need to specify an endpoint',
      endpoints: [
        "/itunes"
      ]
    })
  })
}

const app = servest.createApp();
app.handle(/^\/itunes/, handleiTunes);
app.handle("/", handler);
app.listen({ port: Number(Deno.env.get('PORT')) ?? 8000 });
