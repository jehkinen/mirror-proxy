# Agent instructions — space-proxy

You are editing a **standalone Chrome MV3 unpacked extension**. Path is this folder (not ClipBoss unless the user says so).

## Before changing code

1. Read `docs/CONTEXT.md` (product decisions + storage + message API).
2. Keep changes small; don’t reintroduce hardcoded proxy credentials.
3. Preserve hierarchy: red **Enable** is the main CTA; Mirror's Edge light theme — don't flood accents.

## Files that matter

- `background.js` — parse, proxy, auth, storage, ipify/ipwho/ping
- `popup.html` / `popup.js` — UI
- `manifest.json` — bump `version` on meaningful UX/API changes
- `icons/` — regenerate with Pillow script in CONTEXT/history if needed

## Constraints

- Absolute imports N/A (plain extension JS, no bundler).
- No build step; Load unpacked.
- Proxy auth must stay on `onAuthRequired` + active list item.
- After Save: clear textarea + collapse accordion (popup behavior).

## Verify manually

1. Reload extension on `chrome://extensions`
2. Save `host:port@user:pass`
3. Enable → chip shows flag, IP, country, ping
4. Disable → Chrome direct again

## If user asks to “port to another project”

Copy entire folder; point Chrome Load unpacked at new path; keep `docs/`.
