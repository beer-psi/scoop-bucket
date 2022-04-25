import { DOMParser, NodeList, HTMLElement } from 'https://esm.sh/linkedom';

const UPSTREAM_API = 'https://store.rg-adguard.net/api/GetFiles'

interface StoreData {
  id: string;
  version: string;
  arch: string;
  file: Record<'url' | 'name' | 'extension' | 'size' | 'sha1sum' | 'expiry', string>;
}

function parseDocument(document: HTMLDocument): StoreData[] {
  const rows: NodeList = document.querySelectorAll('tr');
  rows.shift();
  return rows.map(value => {
    const cells: NodeList = value.querySelectorAll('td');
    const filename = cells[0].querySelector('a').textContent.trim()
    const groups = filename.split('_');
    return {
      id: groups[0],
      version: groups[1],
      arch: groups[2],
      file: {
        url: cells[0].querySelector('a')?.href,
        name: filename,
        extension: filename.split('.').at(-1),
        size: cells[3].textContent.trim(),
        sha1sum: cells[2].textContent.trim(),
        expiry: new Date(cells[1].textContent.trim()).toJSON(),
      },  
    }
  })
}

function validateParams(sp: URLSearchParams): boolean {
  if (!sp.has('type') || !sp.has('url') || !sp.has('ring') || !sp.has('lang')) {
    return false;
  }
  // @ts-ignore: Already validated
  if (!['ProductId', 'CategoryId', 'url', 'PackageFamilyName'].includes(sp.get('type'))) {
    return false;
  }
  // @ts-ignore: Already validated
  if (!['Fast', 'Slow', 'RP', 'Retail'].includes(sp.get('ring'))) {
    return false;
  }
  if (sp.get('lang') !== 'en-US') {
    return false;
  }
  return true;
}

export default async function handleRequest(request: Request): Promise<Response> {
  const sp = new URL(request.url).searchParams
  if (!validateParams(sp)) {
    return new Response(
      JSON.stringify({ 
        message: 'invalid parameters', 
        params: {
          'type': "'ProductId' | 'CategoryId' | 'url' | 'PackageFamilyName'",
          'url': 'string',
          'ring': "'Fast' | 'Slow' | 'RP' | 'Retail'",
          'lang': 'en-US',
        }
      }, null, 2),
      {
        status: 400,
        headers: {
          'content-type': 'application/json; charset=utf-8',
        }
      }
    )
  }
  const resp = await fetch(UPSTREAM_API, {
    method: 'POST',
    body: sp.toString(),
    headers: {
      'user-agent': 'Deno/1.0 (Deno Deploy)',
      'content-type': 'application/x-www-form-urlencoded',
    },
  })
  if (resp.ok) {
    const document = new DOMParser().parseFromString(await resp.text(), 'text/html')
    const data = parseDocument(document)
    return new Response(
      JSON.stringify(data),
      {
        headers: {
          'content-type': 'application/json; charset=UTF-8',
        }
      }
    )
  }
  return new Response(
    JSON.stringify({ message: 'couldn\'t process your request'}),
    {
      status: 500,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      }
    }
  )
}
