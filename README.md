# scoop-bucket
The Deno API that powers my scoop bucket. Hosted on [Deno Deploy](https://deno.com/deploy).

## Endpoints
Base URL: `https://beerpsi-scoop.deno.dev`

<details>
    <summary>`GET /itunes`</summary>

Information source: [The iPhone Wiki](https://www.theiphonewiki.com/wiki/ITunes)
- Query parameters:
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
