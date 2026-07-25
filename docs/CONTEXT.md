# Mirror Proxy — full context (for moving to another project / agent)

Copy this whole folder. Open it in Cursor in any repo. Read `docs/CONTEXT.md` first (this file).

## Why it exists

User needed a **browser-only** proxy (not system-wide Clash / macOS Network). SwitchyOmega felt painful. Solution: tiny unpacked Chrome extension with:

1. Pasteable proxy string
2. Saved list + select active
3. Enable / disable for Chrome only
4. Verify via exit IP + country + ping
5. Dark modern UI, mint accent reserved mostly for the Enable CTA

Proxy provider used during build: **Proxy.Market** (`pool.proxy.market:10000@login:pass` style). Credentials must **not** be hardcoded — user pastes into UI.

## Product decisions (do not undo casually)

| Decision | Reason |
|---|---|
| Browser-only via `chrome.proxy` | System proxy hits Cursor/npm/Telegram |
| List of proxies, not one string | Switch between exits |
| After Save: clear input + collapse accordion | Glanceable main surface = toggle + list |
| Accordion for “Add proxy” | Add form is rare; don’t steal focus from Enable |
| Status = small chip, not big grid | Hierarchy; less visual noise |
| Chip: flag + IP · country + ping ms | Glanceable health |
| Mint glow almost only on **Enable** (offline) | When online, “Disable” is quiet secondary |
| Active list item = left mint bar, not green flood | Eye finds Enable button |
| Host in list/status, not `user:***@host` | Less credential clutter |
| No default proxy in code | User insisted; empty until paste |

## UI map (popup)

1. Hero: logo + **Mirror Proxy** + status chip
2. Panel: **Enable / Disable** (primary when off)
3. Accordion: textarea `host:port@user:pass` or separate fields + Save + Check
4. Panel: list (click = active, ✕ = delete)
5. Status chip: `🏳️ IP · Country, City …… N ms`
6. Toast for errors / short confirms

## Architecture

```
popup.js  --messages-->  background.js service worker
                              |
                              |-- chrome.proxy.settings (fixed_servers HTTP)
                              |-- chrome.webRequest.onAuthRequired (asyncBlocking)
                              |-- chrome.storage.local
                              |-- fetch ipify + ipwho.is (when proxy applied, traffic goes through it)
```

### Storage shape (`chrome.storage.local`)

```js
{
  enabled: boolean,
  proxies: Array<{
    id: string,
    host: string,
    port: number,
    username: string,
    password: string,
    raw: string,
    label: string,         // optional display name
    lastIp: string,
    country: string,       // "Georgia, Tbilisi"
    countryCode: string,   // "GE" → emoji flag
    pingMs: number,
    checkedAt: string      // ISO
  }>,
  activeId: string | null,
  lastIp: string,
  country: string,
  countryCode: string,
  pingMs: number,
  lastCheckedAt: string
}
```

Legacy single-proxy keys (`proxy`, `proxyString`) are migrated once in `migrateLegacy()`.

### Message API (`popup` ↔ `background`)

All replies: `{ ok: true, data }` or `{ ok: false, error: string }`.

| type | payload | effect |
|---|---|---|
| `getStatus` | — | full state |
| `saveProxy` | `{ proxyString }` | parse, upsert list, set active, clear handled in popup |
| `selectProxy` | `{ id }` | set active; re-apply if enabled |
| `deleteProxy` | `{ id }` | remove; pick next active / disable if empty |
| `setEnabled` | `{ enabled }` | apply or clear `chrome.proxy` |
| `checkProxy` | — | enable if needed, fetch IP/geo/ping, persist |
| `refreshIp` | — | same fetch while enabled |
| `parsePreview` | `{ proxyString }` | validate for live hint |

### Auth

`onAuthRequired` with `asyncBlocking` + `webRequestAuthProvider`. Only when `details.isProxy`. Credentials from **active** proxy in storage.

### Ping

RTT of the ipify request in ms (`Date.now()` around `fetch`). Not ICMP — “HTTP latency through proxy”. Good enough for UI.

### Flag

`country_code` from ipwho.is → regional indicator symbols:

```js
String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0)))
```

## Design tokens (v1.7) — Mirror's Edge punch

- Sky `#00b4ff` full-bleed (not washed pastels)
- Runner red `#ff1e2d`, yellow `#ffe600` for live/on
- Hard black borders + offset shadows (comic/ME UI energy)
- Brand block with red diagonal slash
- Italic condensed uppercase type


## Known gaps / next ideas (not implemented)

- Per-site / PAC rules (only global Chrome proxy)
- SOCKS5 as scheme (port works as HTTP CONNECT today)
- Import/export list JSON
- Latency history graph
- Firefox port (different APIs)
- Publish to Chrome Web Store (needs privacy policy for proxy permission)

## How it was tested

```bash
curl -x "http://USER:PASS@pool.proxy.market:10000" https://api.ipify.org
# without auth → 407
# X-Proxy-Exit-IP on CONNECT
```

Extension check: Enable → chip shows new IP ≠ home IP.

## Move to another project

1. Copy this folder anywhere (folder name can stay; product name is Mirror Proxy).
2. Optional: `git init` in the folder if you want versioning separate from ClipBoss.
3. In new Cursor workspace: open the folder; agent should read `docs/AGENTS.md` + `docs/CONTEXT.md`.
4. Reload unpacked extension pointing at the new path.

**Do not** commit real proxy passwords into git. Storage is local to the browser profile.

## Chat origin summary

User asked to check Proxy.Market string → wanted browser config → rejected SwitchyOmega → Clash Verge existed but they wanted browser-only → custom extension built iteratively (toggle → settings/parse/check → no default → rename Mirror Proxy → list + country → dark UI + icons → accordion add form → reduce accent noise → compact status chip with ping + flag) → asked to dump Cursor context into the extension folder for painless migration.

## Design tokens (v1.8) — Ableton / high-end dark

- Background `#191919`, surfaces `#232323` / `#2a2a2a`
- Hairline borders `#333`–`#444`, text `#e6e6e6`, muted `#8c8c8c`
- Accent Ableton orange `#ff764d` only for CTA / live / selection
- Flat, dense, no comic shadows or ME cyan wash
