import { DOMParser, NodeList, HTMLElement } from "https://esm.sh/linkedom";
import * as servest from "https://deno.land/x/servest@v1.3.1/mod.ts";


const ITUNES_VERSIONS_TABLE = "https://www.theiphonewiki.com/wiki/ITunes";

interface ITunesVersion {
  version: string;
  qt_version: string | null;
  amds_version: string;
  aas_version: string | null;
  url: string | null;
  sha1sum: string | null;
  size: number | null;
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
                ? array[index - 1].querySelectorAll('td')[0].textContent.trim()
                : cells[0].textContent.trim(),
      qt_version: cells[cells.length - 7].textContent.trim() === '—' ? null : cells[cells.length - 7].textContent.trim(),
      amds_version: cells[cells.length - 6].textContent.trim(),
      aas_version: cells[cells.length - 5].textContent.trim() === '—' ? null : cells[cells.length - 5].textContent.trim(),
      url: cells[cells.length - 4].textContent.trim() === 'N/A' ? null : cells[cells.length - 4].querySelector('a')?.href,
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
                ? array[index - 1].querySelectorAll('td')[0].textContent.trim()
                : cells[0].textContent.trim(),
      qt_version: null,
      amds_version: cells[cells.length - 6].textContent.trim(),
      aas_version: cells[cells.length - 5].textContent.trim() === '—' ? null : cells[cells.length - 5].textContent.trim(),
      url: cells[cells.length - 4].textContent.trim() === 'N/A' ? null : cells[cells.length - 4].querySelector('a')?.href,
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
                ? array[index - 1].querySelectorAll('td')[0].textContent.trim()
                : cells[0].textContent.trim(),
      qt_version: null,
      amds_version: cells[cells.length - 5].textContent.trim(),
      aas_version: null,
      url: cells[cells.length - 4].textContent.trim() === 'N/A' ? null : cells[cells.length - 4].querySelector('a')?.href,
      sha1sum: cells[cells.length - 3].textContent.trim() === 'N/A' ? null : cells[cells.length - 3].textContent.trim(),
      size: cells[cells.length - 2].textContent.trim() === 'N/A' ? null : Number(cells[cells.length - 2].textContent.replaceAll(',', '').trim()),
    };
  });
}

export default async function handleRequest(request: servest.ServerRequest): Promise<void> {
  const resp = await fetch(ITUNES_VERSIONS_TABLE, {
    method: 'GET',
    headers: {
      'user-agent': 'Deno/1.0 (Deno Deploy)'
    }
  });
  if (resp.ok) {
    const document = new DOMParser().parseFromString(await resp.text(), "text/html")
    const sp = new URLSearchParams(request.url.split('?', 2)[1])
    console.log(sp)
    if (Array.from(sp.keys()).length === 0) {
      const response = {
        windows: {
          x86: getVersionsWindows(document, Tables.WINDOWS_32BIT),
          x64: getVersionsWindows(document, Tables.WINDOWS_64BIT),
          older_video_cards: getVersionsWindowsOlderCards(document, Tables.WINDOWS_64BIT_OLDER_VIDEO_CARDS),
        },
        macos: getVersionsMacOS(document, Tables.MACOS)
      }
      return await request.respond({
        status: 200,
        headers: new Headers({
          'content-type': 'application/json; charset=utf-8',
        }),
        body: JSON.stringify(response)
      });
    }
    const os: string | null = sp.get('os')
    const type: string | null = sp.get('type')
    let data;
    if (os === 'windows') {
      if (type === 'x86') {
        data = getVersionsWindows(document, Tables.WINDOWS_32BIT)
      } else if (type === 'x64') {
        data = getVersionsWindows(document, Tables.WINDOWS_64BIT)
      } else if (type === 'older_video_cards') {
        data = getVersionsWindowsOlderCards(document, Tables.WINDOWS_64BIT_OLDER_VIDEO_CARDS)
      } else {
        return await request.respond({
          status: 400,
          headers: new Headers({
            'content-type': 'application/json; charset=utf-8',
          }),
          body: JSON.stringify({ message: "invalid type for os windows", valid: ["x86", "x64", "older_video_cards"] })
        })
      }
    } else if (os === 'macos') {
      data = getVersionsMacOS(document, Tables.MACOS)
    } else {
      return await request.respond({
        status: 400,
        headers: new Headers({
          'content-type': 'application/json; charset=utf-8',
        }),
        body: JSON.stringify({ message: "invalid os", valid: ["windows", "macos"] })
      })
    }
    if (sp.has('dl')) {
      const version = sp.get('dl');
      const url = version ? data.filter((value) => value.version === version)[0].url : data[data.length - 1].url;
      if (url) {
        return await request.redirect(url)
      } else {
        return await request.respond({
          status: 404,
          headers: new Headers({
            'content-type': 'application/json; charset=utf-8',
          }),
          body: JSON.stringify({ message: "download link not found" })
        })
      }
    } else {
      return await request.respond({
        status: 200,
        headers: new Headers({
          'content-type': 'application/json; charset=utf-8',
        }),
        body: JSON.stringify(data)
      });
    }
  }
  return await request.respond({
    status: 500,
    headers: new Headers({
      'content-type': 'application/json; charset=utf-8',
    }),
    body: JSON.stringify({ message: 'couldn\'t process your request '}),
  });
}
