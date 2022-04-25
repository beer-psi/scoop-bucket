# scoop-bucket
The Deno API that powers my scoop bucket. Hosted on [Deno Deploy](https://deno.com/deploy).

## Endpoints
Base URL: `https://beerpsi-scoop.deno.dev`

<details>
    <summary>`GET /itunes`</summary>

Information source: [The iPhone Wiki](https://www.theiphonewiki.com/wiki/ITunes)

Query parameters:
- `os` (`windows | macos`) 
- `type` (`x86 | x64 | older_video_cards`) Required if using `dl` and `os` is Windows
- `dl`: Leave blank to download latest version **with a download**, or specify a version yourself

If `dl` isn't specified, return JSON with information about iTunes versions, filtered by `os` and `type`:
```ts
interface ITunesVersion {
  version: string;
  qt_version: string | null;
  amds_version: string;
  aas_version: string | null;
  url: string | null;
  sha1sum: string | null;
  size: number | null;
}
```

Example: `GET /itunes?os=windows&type=x64`
```json
[
  {
    "version": "12.12.2.2",
    "qt_version": null,
    "amds_version": "15.0.0.16",
    "aas_version": null,
    "url": "https://secure-appldnld.apple.com/itunes12/002-16263-20211027-C3421E95-F58B-4691-BD76-672A0D346AFB/iTunes64Setup.exe",
    "sha1sum": "3f7bc94532951707939c9ab2c509297bb9422545",
    "size": 210241608
  },
  {
    "version": "12.12.3.5",
    "qt_version": null,
    "amds_version": "15.5.0.16",
    "aas_version": null,
    "url": "https://secure-appldnld.apple.com/itunes12/002-35070-20220304-5521E72A-137B-4F09-9844-45BEBA5C3B40/iTunes64Setup.exe",
    "sha1sum": "16292cc7627ddad126e5237a0c0801f1f659e055",
    "size": 209718344
  },
  // ...
]
```
</details>

<details>
    <summary>GET /store</summary>

Information source: https://store.rg-adguard.net

Query parameters:
```ts
interface Parameters {
    type: 'ProductId' | 'CategoryId' | 'url' | 'PackageFamilyName';
    url: string;
    ring: 'Fast' | 'Slow' | 'RP' | 'Retail';
    lang: 'en-US';
}
```

Response: `StoreData[]`
```ts
interface StoreData {
  id: string;
  version: string;
  arch: string;
  url: string;
  expiry: string;
  sha1sum: string;
  size: number;
}
```

Example: `GET /store?type=url&url=https://www.microsoft.com/en-us/p/icloud/9pktq5699m62&ring=Retail&lang=en-US`
```json
[
  {
    "id": "AppleInc.iCloud",
    "version": "13.0.201.0",
    "arch": "x86",
    "url": "http://dl.delivery.mp.microsoft.com/filestreamingservice/files/029d5d56-67bb-4449-8d8e-d1bcf20fff22",
    "expiry": "1970-01-01T00:00:00.000Z",
    "sha1sum": "43fa28a7d2d7ac847ca530c65d299dfd6aadbddd",
    "size": "315.63 KB"
  },
  {
    "id": "AppleInc.iCloud",
    "version": "13.0.201.0",
    "arch": "x86",
    "url": "http://tlu.dl.delivery.mp.microsoft.com/filestreamingservice/files/174bf1fc-865a-4ce2-af40-31e451020d6b?P1=1650855628&P2=404&P3=2&P4=jsdzR9I%252fCJtrjnbdszIM7LL%252bJ4hetXOxf9l0DTzotmDJFrzwkiPu0bP3netRe9x7U3Ngt3aUoY2ejoHZlfmKUw%253d%253d",
    "expiry": "2022-04-25T03:00:28.000Z",
    "sha1sum": "c184b17f7edf695321a70d82f2ef1dbaab9c4fa2",
    "size": "254.87 MB"
  },
  // ...
]
```
</details>
