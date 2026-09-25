---
title: Static files and SPA fallback
description: Serve a built frontend beside Arc routes from the standalone Node host, and know which requests reach Arc, a file, or the fallback.
---

A single-page application and its API often ship together. The standalone Node host can serve the built frontend on the same port as Arc, so you do not need a web framework or a second server for it.

## Serve a public directory

```typescript title="main.ts (excerpt)"
await app.run({
    port: 3000,
    host: '127.0.0.1',
    pathBase: '/app',
    staticFiles: { root: 'public', defaultDocument: 'index.html' },
    fallback: 'index.html'
});
```

`app` is a built `ArcApplication`; `runArc(server, options)` accepts the same options. With this configuration, `GET /app/` serves `public/index.html`, and `GET /app/dashboard` with `Accept: text/html` serves the same file. Requests outside `/app` return 404.

`staticFiles.root` is resolved relative to the working directory. Startup fails if the directory is missing or the platform lacks `O_NOFOLLOW`. Nothing is served unless you configure `staticFiles`. Only put public files there: never credentials or private uploads.

| `staticFiles` option | Effect |
| --- | --- |
| `root` | The public directory |
| `defaultDocument` | File served for a directory request; `index.html` by default |
| `contentTypes` | Extra or overriding content types, keyed by extension |
| `wellKnown` | Relative names under `.well-known/` to expose, such as `.well-known/security.txt`; other dotpaths stay blocked |

## Which request goes where

1. **Arc endpoints win**, even on the wrong HTTP method: Arc answers with 405. API-prefix and `/.cratis` paths are reserved case-insensitively before static lookup and fallback.
2. **Public files** come next, for GET and HEAD only. A directory URL without a trailing slash is redirected with 301.
3. **The fallback** answers GET and HEAD requests whose `Accept` includes `text/html`, for extensionless paths outside Arc's API prefix and `/.cratis`. An unknown API route never returns your SPA shell. If you configure no route prefix, disable the fallback when you need to reserve unknown root-level API paths.
4. Everything else gets a plain-text 404 `Not Found`.

Requests using non-canonical spellings (percent escapes or repeated slashes) and endpoint paths in a different case return 404.

## Caching and content

- The default document and the fallback send `Cache-Control: no-cache`. Static responses and 404s send `X-Content-Type-Options: nosniff`.
- `If-None-Match` lists, weak ETags, and `*` produce 304; `If-None-Match` takes precedence over `If-Modified-Since`.
- Range requests receive the full 200 response with `Accept-Ranges: none`. Media seeking is not supported.
- Files are streamed up to their measured length.

## What the host refuses

The host rejects path traversal, dotfiles, NUL bytes, backslashes, Windows alternate data streams and device names, and symbolic links that escape the resolved root or point at a dotfile. Symbolic links to ordinary files inside the root are allowed.

:::caution[Public files skip authentication]
Neither static files nor the fallback run Arc authentication or tenancy. XML and SVG files remain active same-origin content, so only serve trusted assets. Protect private files through authorized operations, not the public directory.
:::

## Limits

There is no directory listing, private file authorization, multiple static roots, static request path independent of `pathBase`, list of default documents, or byte-range response.

## Related

- [Arc.Core and the standalone Node host](index.md)
- [Endpoint mapping](endpoint-mapping.md)
