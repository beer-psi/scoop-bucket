import { DOMParser, NodeList, HTMLElement } from 'https://esm.sh/linkedom';

const UPSTREAM_API = 'https://store.rg-adguard.net/api/GetFiles'

interface StoreData {
  id: string;
  version: string;
  arch: string;
  file: {
    url: string;
    name: string;
    extension: string;
    size: string;
    sha1sum: string
    expiry: string
  };
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
          'type': "'ProductId' | 'CategoryId' | 'url' | 'PackageFamilyName",
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
    body: `type=${sp.get('type')}&url=${sp.get('url')}&ring=${sp.get('ring')}&lang=${sp.get('lang')}`,
    headers: {
      'user-agent': 'Deno/1.0 (Deno Deploy)',
      'content-type': 'application/x-www-form-urlencoded',
    },
  })
  if (resp.ok) {
    const document = new DOMParser().parseFromString(await resp.text(), 'text/html')
    const data = parseDocument(document)
    const id = sp.get('id');
    const version = sp.get('version');
    const arch = sp.get('arch');
    const name = sp.get('name');
    const extension = sp.get('extension');
    const ret = data.filter(value => id === null || value.id === id)
        .filter(value => version === null || value.version === version)
        .filter(value => arch === null || value.arch === arch)
        .filter(value => name === null || value.file.name === name)
        .filter(value => extension === null || value.file.extension === extension)
    if (sp.has('dl')) {
      if (ret.length > 1) {
        return new Response(
          JSON.stringify({
            message: 'There are more than one version matching criteria. Use more filters.',
            filters: ['id', 'version', 'arch', 'name', 'extension'],
          }, null, 2),
          {
            status: 300,
            headers: {
              'content-type': 'application/json; charset=UTF-8',
            }
          }
        )
      }
      if (ret.length === 0) {
        return new Response(
          JSON.stringify({ message: 'download link not found' }),
          {
            status: 404,
            headers: {
              'content-type': 'application/json; charset=utf-8',  
            }
          }
        )
      }
      return Response.redirect(ret[0].file.url, 302)
    }
    return new Response(
      JSON.stringify(ret),
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
