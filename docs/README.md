# Mirror Proxy

Chrome MV3 extension: **browser-only HTTP proxy** with a saved proxy list, one-click enable, exit IP / country / ping chip.

**Author:** Andrei B · [andydev.space](https://andydev.space/) · [jehkinen@gmail.com](mailto:jehkinen@gmail.com)

Originally built in a Cursor chat (2026-07-24) after testing Proxy.Market credentials. Not part of ClipBoss — standalone folder.

## Install

1. Chrome → `chrome://extensions`
2. Developer mode ON
3. **Load unpacked** → this folder
4. Paste proxy string → Save → pick from list → Enable

Does **not** touch macOS system proxy / Clash / other apps. Only this Chrome profile’s traffic via `chrome.proxy`.

## Folder layout

```
space-proxy/
  manifest.json
  background.js
  popup.html
  popup.js
  icons/
  scripts/
  docs/
    README.md      # install / overview
    CONTEXT.md     # full product + tech context
    AGENTS.md      # agent instructions
```

## Proxy string formats (parsed)

Colon / `@` formats:

- `host:port@user:pass` — Proxy.Market style
- `user:pass@host:port`
- `host:port:user:pass`
- `user:pass:host:port`
- `host:port` (no auth)
- Passwords with `:` are supported (`user:p:a:ss@host:port`, `host:port:user:p:a:ss`)

URL-style (scheme is stripped; proxy still applied as HTTP):

- `http://user:pass@host:port`
- `https://host:port`
- `socks5://user:pass@host:port`
- `socks5h://host:port`

IPv6:

- `[2001:db8::1]:8080`
- `user:pass@[2001:db8::1]:8080`
- `2001:db8::1:8080` (unbracketed)

Other delimiters (one proxy per line in bulk import):

- `host|port|user|pass`
- `host,port,user,pass`
- `host;port;user;pass`
- `host port user pass` (whitespace)
- Lines starting with `#` are ignored in bulk import

Optional display name (line / bulk / name field):

- `Name :: host:port@user:pass` — name before proxy, separated by ` :: `
- Or use the **Name** field when adding via Line / Fields
- Rename later: pencil icon or double-click the name in the list

## Permissions

- `proxy` — set fixed HTTP proxy for Chrome
- `storage` — list + active + last check
- `webRequest` + `webRequestAuthProvider` — inject Basic auth for proxy CONNECT
- `<all_urls>` — needed for auth + checks

## External APIs used for checks

- `https://api.ipify.org?format=json` — exit IP (+ RTT ≈ ping)
- `https://ipwho.is/{ip}` — country, city, `country_code` → flag emoji

## Version

See `manifest.json` (`1.3.3` at handoff).
