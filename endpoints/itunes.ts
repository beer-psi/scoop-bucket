import { DOMParser, NodeList, HTMLElement } from 'https://esm.sh/linkedom@0.14.7';
import { HTMLDocument } from 'https://cdn.esm.sh/v78/linkedom@0.14.7/types/html/document.d.ts';
import { LRU } from 'https://deno.land/x/lru@1.0.2/mod.ts';
import { StatusCodes, ReasonPhrases } from 'https://esm.sh/http-status-codes@2.2.0';

const lru = new LRU(1);
const lruJSON = new LRU(1);


const ITUNES_VERSIONS_TABLE = 'https://www.theiphonewiki.com/wiki/ITunes';

interface ITunesVersion {
  version: string;
  qt_version: string | null;
  amds_version: string;
  aas_version: string | null;
  url: string | null;
  sha1sum: string | null;
  size: number | null;
}

interface ITunesData {
  windows: Record<string, ITunesVersion[]>;
  macos: ITunesVersion[];
}

enum Tables {
  MACOS,
  WINDOWS_32BIT,
  WINDOWS_64BIT,
  WINDOWS_64BIT_OLDER_VIDEO_CARDS,
}

function getVersionsWindows(document: HTMLDocument, type: Tables): ITunesVersion[] {
  const rows: NodeList = document.querySelectorAll('table.wikitable')[type].querySelectorAll('tr');
  rows.shift();
  return rows.map((value: HTMLElement, index: number, array: HTMLElement[]) => {
    const cells: NodeList = value.querySelectorAll('td')
    return {
      version: cells.length < 8 
                ? array[index - 1].querySelectorAll('td')[0].textContent.trim().replaceAll(/\[\d+\]/g, '')
                : cells[0].textContent.trim().replaceAll(/\[\d+\]/g, ''),
      qt_version: cells[cells.length - 7].textContent.trim() === '—' ? null : cells[cells.length - 7].textContent.trim(),
      amds_version: cells[cells.length - 6].textContent.trim(),
      aas_version: cells[cells.length - 5].textContent.trim() === '—' ? null : cells[cells.length - 5].textContent.trim(),
      url: cells[cells.length - 4].textContent.trim() === 'N/A' ? null : decodeURI(cells[cells.length - 4].querySelector('a')?.href),
      sha1sum: cells[cells.length - 3].textContent.trim() === 'N/A' ? null : cells[cells.length - 3].textContent.trim(),
      size: cells[cells.length - 2].textContent.trim() === 'N/A' ? null : Number(cells[cells.length - 2].textContent.replaceAll(',', '').trim()),
    };
  });
}

function getVersionsWindowsOlderCards(document: HTMLDocument, type: Tables): ITunesVersion[] {
  const rows: NodeList = document.querySelectorAll('table.wikitable')[type].querySelectorAll('tr');
  rows.shift();
  return rows.map((value: HTMLElement, index: number, array: HTMLElement[]) => {
    const cells: NodeList = value.querySelectorAll('td')
    return {
      version: cells.length < 7
                ? array[index - 1].querySelectorAll('td')[0].textContent.trim().replaceAll(/\[\d+\]/g, '')
                : cells[0].textContent.trim().replaceAll(/\[\d+\]/g, ''),
      qt_version: null,
      amds_version: cells[cells.length - 6].textContent.trim(),
      aas_version: cells[cells.length - 5].textContent.trim() === '—' ? null : cells[cells.length - 5].textContent.trim(),
      url: cells[cells.length - 4].textContent.trim() === 'N/A' ? null : decodeURI(cells[cells.length - 4].querySelector('a')?.href),
      sha1sum: cells[cells.length - 3].textContent.trim() === 'N/A' ? null : cells[cells.length - 3].textContent.trim(),
      size: cells[cells.length - 2].textContent.trim() === 'N/A' ? null : Number(cells[cells.length - 2].textContent.replaceAll(',', '').trim()),
    };
  });
}

function getVersionsMacOS(document: HTMLDocument, type: Tables): ITunesVersion[] {
  const rows: NodeList = document.querySelectorAll('table.wikitable')[type].querySelectorAll('tr');
  rows.shift();
  return rows.map((value: HTMLElement, index: number, array: HTMLElement[]) => {
    const cells: NodeList = value.querySelectorAll('td')
    return {
      version: cells.length < 6
                ? array[index - 1].querySelectorAll('td')[0].textContent.trim().replaceAll(/\[\d+\]/g, '')
                : cells[0].textContent.trim().replaceAll(/\[\d+\]/g, ''),
      qt_version: null,
      amds_version: cells[cells.length - 5].textContent.trim(),
      aas_version: null,
      url: cells[cells.length - 4].textContent.trim() === 'N/A' ? null : decodeURI(cells[cells.length - 4].querySelector('a')?.href),
      sha1sum: cells[cells.length - 3].textContent.trim() === 'N/A' ? null : cells[cells.length - 3].textContent.trim(),
      size: cells[cells.length - 2].textContent.trim() === 'N/A' ? null : Number(cells[cells.length - 2].textContent.replaceAll(',', '').trim()),
    };
  });
}

async function fetchWikiWithCache(url: string): Promise<Response> {
  const respHead = await fetch(url, {
    method: 'HEAD',
    headers: {
      'user-agent': 'Deno/1.0 (Deno Deploy)'
    }
  })
  if (respHead.ok && respHead.headers.get('last-modified')) {
    // @ts-ignore: Already checked for nullness
    const lastModified = String(new Date(respHead.headers.get('last-modified')).getTime())
    if (!lru.has(lastModified)) {
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'user-agent': 'Deno/1.0 (Deno Deploy)'
        }
      });
      lru.set(lastModified, await resp.text())
    }
    return new Response(
      <string>lru.get(lastModified),
      {
        status: StatusCodes.OK,
        statusText: ReasonPhrases.OK,
        headers: new Headers({
          'last-modified': new Date(Number(lastModified)).toISOString()
        })
      }
    )
  }
  return fetch(url, {
    method: 'GET',
    headers: {
      'user-agent': 'Deno/1.0 (Deno Deploy)'
    }
  });
}

function fetchTableWithCache(text: string, lastModified: string): ITunesData {
  if (!lruJSON.has(lastModified)) {
    const document = new DOMParser().parseFromString(text, 'text/html')
    const response = {
      windows: {
        x86: getVersionsWindows(document, Tables.WINDOWS_32BIT),
        x64: getVersionsWindows(document, Tables.WINDOWS_64BIT),
        older_video_cards: getVersionsWindowsOlderCards(document, Tables.WINDOWS_64BIT_OLDER_VIDEO_CARDS),
      },
      macos: getVersionsMacOS(document, Tables.MACOS)
    }
    lruJSON.set(lastModified, response)
  }
  return <ITunesData>lruJSON.get(lastModified)
}

export default async function handleRequest(request: Request): Promise<Response> {
  const resp = await fetchWikiWithCache(ITUNES_VERSIONS_TABLE);
  const sp = new URL(request.url).searchParams
  if (resp.ok && resp.headers.get('last-modified')) {
    // @ts-ignore: Already checked for nullness
    const allVersions = fetchTableWithCache(await resp.text(), String(new Date(resp.headers.get('last-modified')).getTime()));
    if (Array.from(sp.keys()).length === 0) {
      return new Response(
        JSON.stringify(allVersions),
        {
          status: StatusCodes.OK,
          statusText: ReasonPhrases.OK,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'access-control-allow-origin': '*',
          }
        }
      );
    }
    const os: string | null = sp.get('os')
    const type: string | null = sp.get('type')
    let data;
    if (os === 'windows' || os === 'macos') {
      if (type === null) {
        data = allVersions[os]
      } else if (os === 'windows' && type !== null && Object.prototype.hasOwnProperty.call(allVersions[os], type)) {
        data = allVersions[os][type]
      } else {
        return new Response(
          JSON.stringify({ message: 'invalid type for os', valid: os === 'windows' ? ['x86', 'x64', 'older_video_cards'] : [] }),
          {
            status: StatusCodes.BAD_REQUEST,
            statusText: ReasonPhrases.BAD_REQUEST,
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'access-control-allow-origin': '*',
            }
          }
        )
      }
    } else {
      return new Response(
        JSON.stringify({ message: 'invalid os', valid: ['windows', 'macos'] }),
        {
          status: StatusCodes.BAD_REQUEST,
          statusText: ReasonPhrases.BAD_REQUEST,
          headers: {
            'content-type': 'application/json; charset=utf-8',  
            'access-control-allow-origin': '*',
          }
        }
      )
    }
    if (sp.has('dl')) {
      if (os === 'windows' && !sp.has('type')) {
        return new Response(
          JSON.stringify({ message: 'Need to specify a build type', valid: ['x86', 'x64', 'older_video_cards'] }),
          {
            status: StatusCodes.MULTIPLE_CHOICES,
            statusText: ReasonPhrases.MULTIPLE_CHOICES,
            headers: {
              'content-type': 'application/json; charset=utf-8', 
              'access-control-allow-origin': '*', 
            }
          }
        )
      }
      const version = sp.get('dl');
      const versions = <ITunesVersion[]>data;
      const url = version ? versions.filter((value) => value.version === version)[0].url : versions.map(value => value.url).filter(value => value).at(-1);
      if (url) {
        return Response.redirect(url, StatusCodes.TEMPORARY_REDIRECT)
      } else {
        return new Response(
          JSON.stringify({ message: 'download link not found' }),
          {
            status: StatusCodes.NOT_FOUND,
            statusText: ReasonPhrases.NOT_FOUND,
            headers: {
              'content-type': 'application/json; charset=utf-8',  
              'access-control-allow-origin': '*',
            }
          }
        )
      }
    } else {
      return new Response(
        JSON.stringify(data),
        {
          status: StatusCodes.OK,
          statusText: ReasonPhrases.OK,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'access-control-allow-origin': '*',
          }
        }
      )
    }
  }
  return new Response(
    JSON.stringify({ message: 'couldn\'t process your request'}),
    {
      status: StatusCodes.INTERNAL_SERVER_ERROR,
      statusText: ReasonPhrases.INTERNAL_SERVER_ERROR,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
      }
    }
  )
}
