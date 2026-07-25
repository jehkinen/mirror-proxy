const IPIFY_URL = 'https://api.ipify.org?format=json'

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function isValidPort(value) {
  if (!/^\d+$/.test(value)) return false
  const port = Number(value)
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

function looksLikeHost(value) {
  const host = String(value || '').trim()
  if (!host) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true
  if (host === 'localhost') return true
  if (host.includes('::')) return true
  if (/^[a-zA-Z0-9.-]+$/.test(host) && host.includes('.')) return true
  return /^[a-zA-Z0-9-]{2,}$/.test(host)
}

function stripScheme(text) {
  return String(text || '').replace(/^(?:https?|socks5h?|socks4a?):\/\//i, '')
}

function parseUserPass(text) {
  const value = String(text || '').trim()
  const colon = value.indexOf(':')
  if (colon < 0) return { username: value, password: '' }
  return {
    username: value.slice(0, colon),
    password: value.slice(colon + 1)
  }
}

function parseHostPort(text) {
  const value = String(text || '').trim()
  const bracketMatch = value.match(/^\[([^\]]+)\]:(\d+)$/)
  if (bracketMatch) {
    return { host: bracketMatch[1], port: Number(bracketMatch[2]) }
  }

  const colon = value.lastIndexOf(':')
  if (colon <= 0) throw new Error('Invalid host:port')

  const host = value.slice(0, colon)
  const portStr = value.slice(colon + 1)
  if (!isValidPort(portStr)) throw new Error('Invalid port')

  return { host, port: Number(portStr) }
}

function finalizeParsed(input, parsed) {
  const host = String(parsed.host || '').trim()
  const port = parsed.port
  const username = String(parsed.username || '').trim()
  const password = String(parsed.password || '')

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid host or port')
  }

  return {
    host,
    port,
    username,
    password,
    raw: input
  }
}

function parseDelimited(text) {
  const delimiters = ['|', ',', ';', '\t']
  for (const delimiter of delimiters) {
    if (!text.includes(delimiter)) continue
    const parts = text.split(delimiter).map((part) => part.trim()).filter(Boolean)
    if (parts.length === 2 && isValidPort(parts[1])) {
      return { host: parts[0], port: Number(parts[1]), username: '', password: '' }
    }
    if (parts.length === 4 && isValidPort(parts[1])) {
      return {
        host: parts[0],
        port: Number(parts[1]),
        username: parts[2],
        password: parts[3]
      }
    }
  }

  const spaceParts = text.split(/\s+/).filter(Boolean)
  if (spaceParts.length === 2 && isValidPort(spaceParts[1])) {
    return {
      host: spaceParts[0],
      port: Number(spaceParts[1]),
      username: '',
      password: ''
    }
  }
  if (spaceParts.length === 4 && isValidPort(spaceParts[1])) {
    return {
      host: spaceParts[0],
      port: Number(spaceParts[1]),
      username: spaceParts[2],
      password: spaceParts[3]
    }
  }

  return null
}

function parseAtFormat(text) {
  const at = text.lastIndexOf('@')
  if (at < 0) return null

  const left = text.slice(0, at)
  const right = text.slice(at + 1)

  try {
    const hostPort = parseHostPort(left)
    const auth = parseUserPass(right)
    if (looksLikeHost(hostPort.host)) {
      return { ...hostPort, ...auth }
    }
  } catch {
    // try user:pass@host:port
  }

  const auth = parseUserPass(left)
  const hostPort = parseHostPort(right)
  return { ...hostPort, username: auth.username, password: auth.password }
}

function parseColonFormat(text) {
  if (!text.includes(':')) return null

  if (text.startsWith('[')) {
    const hostPort = parseHostPort(text)
    return { ...hostPort, username: '', password: '' }
  }

  if (text.includes('::')) {
    const hostPort = parseHostPort(text)
    if (hostPort.host.includes('::')) {
      return { ...hostPort, username: '', password: '' }
    }
  }

  const parts = text.split(':')

  if (parts.length >= 4) {
    if (isValidPort(parts[1]) && looksLikeHost(parts[0])) {
      return {
        host: parts[0],
        port: Number(parts[1]),
        username: parts[2],
        password: parts.slice(3).join(':')
      }
    }

    const portStr = parts[parts.length - 1]
    const hostStr = parts[parts.length - 2]
    if (isValidPort(portStr) && looksLikeHost(hostStr)) {
      return {
        username: parts[0],
        password: parts.slice(1, -2).join(':'),
        host: hostStr,
        port: Number(portStr)
      }
    }
  }

  if (parts.length === 2) {
    const hostPort = parseHostPort(text)
    return { ...hostPort, username: '', password: '' }
  }

  return null
}

function parseProxyString(raw) {
  const input = String(raw || '').trim()
  if (!input) throw new Error('Empty proxy string')

  let text = stripScheme(input)
  text = text.replace(/\s+#.*$/, '').trim()
  if (!text) throw new Error('Empty proxy string')

  let parsed = null

  if (text.includes('@')) {
    parsed = parseAtFormat(text)
  } else {
    parsed = parseDelimited(text) || parseColonFormat(text)
  }

  if (!parsed) {
    throw new Error('Unrecognized proxy format')
  }

  return finalizeParsed(input, parsed)
}

function formatProxyLabel(proxy) {
  if (!proxy?.host) return 'not set'
  const auth = proxy.username ? `${proxy.username}:***@` : ''
  return `${auth}${proxy.host}:${proxy.port}`
}

function proxyKey(proxy) {
  return `${proxy.host}:${proxy.port}|${proxy.username || ''}|${proxy.password || ''}`
}

const STORAGE_VERSION = 2
const BACKUP_KEY = 'mirrorProxyBackup'
const SYNC_BACKUP_KEY = 'mirrorProxySyncBackup'
const SYNC_MAX_BYTES = 7500

function normalizeProxies(proxies) {
  if (!Array.isArray(proxies)) return []
  return proxies
    .filter((item) => item?.host && item?.port)
    .map((item) => ({
      ...item,
      label: String(item.label || '').trim()
    }))
}

function splitLabelAndProxy(raw) {
  const text = String(raw || '').trim()
  const sep = text.indexOf(' :: ')
  if (sep > 0) {
    return {
      label: text.slice(0, sep).trim(),
      proxyString: text.slice(sep + 4).trim()
    }
  }
  return { label: '', proxyString: text }
}

function buildBackupPayload(data) {
  return {
    version: STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    enabled: Boolean(data.enabled),
    activeId: data.activeId || null,
    proxies: normalizeProxies(data.proxies),
    lastIp: data.lastIp || '',
    country: data.country || '',
    countryCode: data.countryCode || '',
    pingMs: data.pingMs || 0,
    lastCheckedAt: data.lastCheckedAt || ''
  }
}

async function readMirrorBackup() {
  const stored = await chrome.storage.local.get(BACKUP_KEY)
  const backup = stored[BACKUP_KEY]
  if (!backup || !Array.isArray(backup.proxies) || !backup.proxies.length) return null
  return backup
}

async function readSyncBackup() {
  try {
    const stored = await chrome.storage.sync.get(SYNC_BACKUP_KEY)
    const backup = stored[SYNC_BACKUP_KEY]
    if (!backup || !Array.isArray(backup.proxies) || !backup.proxies.length) return null
    return backup
  } catch {
    return null
  }
}

async function mirrorBackup(data) {
  const backup = buildBackupPayload(data)
  await chrome.storage.local.set({ [BACKUP_KEY]: backup })

  if (!backup.proxies.length) {
    try {
      await chrome.storage.sync.remove(SYNC_BACKUP_KEY)
    } catch {
      // sync unavailable
    }
    return
  }

  const syncPayload = JSON.stringify(backup)
  if (syncPayload.length > SYNC_MAX_BYTES) return

  try {
    await chrome.storage.sync.set({ [SYNC_BACKUP_KEY]: backup })
  } catch {
    // sync quota or disabled
  }
}

async function writeStorage(patch) {
  const current = await chrome.storage.local.get(null)
  const merged = { ...current, ...patch }
  if (patch.proxies !== undefined) {
    merged.proxies = normalizeProxies(patch.proxies)
  }
  await chrome.storage.local.set(merged)
  await mirrorBackup(merged)
}

async function restoreFromBackup(data) {
  const localBackup = await readMirrorBackup()
  const syncBackup = localBackup ? null : await readSyncBackup()
  const backup = localBackup || syncBackup
  if (!backup?.proxies?.length) return data

  const restored = {
    ...data,
    enabled: Boolean(backup.enabled),
    activeId: backup.activeId || null,
    proxies: normalizeProxies(backup.proxies),
    lastIp: backup.lastIp || '',
    country: backup.country || '',
    countryCode: backup.countryCode || '',
    pingMs: backup.pingMs || 0,
    lastCheckedAt: backup.lastCheckedAt || ''
  }

  await chrome.storage.local.set(restored)
  await mirrorBackup(restored)
  return restored
}

async function getBackupInfo() {
  const localBackup = await readMirrorBackup()
  const syncBackup = localBackup ? null : await readSyncBackup()
  const backup = localBackup || syncBackup
  if (!backup) {
    return { savedAt: '', count: 0, source: '' }
  }
  return {
    savedAt: backup.savedAt || '',
    count: backup.proxies.length,
    source: localBackup ? 'local' : 'sync'
  }
}

async function exportBackup() {
  const data = await loadStorageData()
  return buildBackupPayload(data)
}

async function importBackup(payload) {
  if (!payload || !Array.isArray(payload.proxies)) {
    throw new Error('Invalid backup file')
  }

  const proxies = normalizeProxies(payload.proxies).map((item) => ({
    id: item.id || newId(),
    host: item.host,
    port: item.port,
    username: item.username || '',
    password: item.password || '',
    raw: item.raw || '',
    label: item.label || '',
    lastIp: item.lastIp || '',
    country: item.country || '',
    countryCode: item.countryCode || '',
    pingMs: item.pingMs || 0,
    checkedAt: item.checkedAt || ''
  }))

  if (!proxies.length) throw new Error('No proxies in backup')

  let activeId = payload.activeId || null
  if (!proxies.some((item) => item.id === activeId)) {
    activeId = proxies[0].id
  }

  await writeStorage({
    enabled: false,
    proxies,
    activeId,
    lastIp: payload.lastIp || '',
    country: payload.country || '',
    countryCode: payload.countryCode || '',
    pingMs: payload.pingMs || 0,
    lastCheckedAt: payload.lastCheckedAt || ''
  })

  await clearProxySettings()
  await updateBadge(false)
  return getState()
}

async function migrateLegacy(data) {
  if (Array.isArray(data.proxies)) return data

  const backup = await readMirrorBackup() || await readSyncBackup()
  if (backup?.proxies?.length) {
    return restoreFromBackup(data)
  }

  const proxies = []
  let activeId = null

  if (data.proxy?.host || data.proxyString) {
    try {
      const parsed = data.proxy?.host
        ? {
            host: data.proxy.host,
            port: data.proxy.port,
            username: data.proxy.username || '',
            password: data.proxy.password || '',
            raw: data.proxy.raw || data.proxyString || ''
          }
        : parseProxyString(data.proxyString)
      const id = newId()
      proxies.push({
        id,
        ...parsed,
        lastIp: data.lastIp || '',
        country: '',
        checkedAt: data.lastCheckedAt || ''
      })
      activeId = id
    } catch {
      // ignore legacy junk
    }
  }

  const next = {
    enabled: Boolean(data.enabled) && Boolean(activeId),
    proxies,
    activeId,
    lastIp: data.lastIp || '',
    country: '',
    lastCheckedAt: data.lastCheckedAt || ''
  }

  await writeStorage(next)
  return next
}

async function loadStorageData() {
  const raw = await chrome.storage.local.get({
    enabled: false,
    proxies: null,
    activeId: null,
    proxy: null,
    proxyString: '',
    lastIp: '',
    country: '',
    countryCode: '',
    pingMs: 0,
    lastCheckedAt: ''
  })

  let data = await migrateLegacy(raw)
  if (!Array.isArray(data.proxies)) {
    data = await restoreFromBackup(data)
  }
  return data
}

async function getState() {
  const data = await loadStorageData()
  const proxies = Array.isArray(data.proxies) ? data.proxies : []
  const activeId = data.activeId || null
  const proxy = proxies.find((item) => item.id === activeId) || null

  return {
    enabled: Boolean(data.enabled),
    proxies,
    activeId,
    proxy,
    lastIp: data.lastIp || proxy?.lastIp || '',
    country: data.country || proxy?.country || '',
    countryCode: data.countryCode || proxy?.countryCode || '',
    pingMs: data.pingMs || proxy?.pingMs || 0,
    lastCheckedAt: data.lastCheckedAt || proxy?.checkedAt || ''
  }
}

async function applyProxySettings(proxy) {
  await chrome.proxy.settings.set({
    value: {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: 'http',
          host: proxy.host,
          port: proxy.port
        },
        bypassList: ['localhost', '127.0.0.1', '<local>']
      }
    },
    scope: 'regular'
  })
}

async function clearProxySettings() {
  await chrome.proxy.settings.clear({ scope: 'regular' })
}

async function updateBadge(enabled) {
  await chrome.action.setBadgeText({ text: enabled ? 'ON' : '' })
  await chrome.action.setBadgeBackgroundColor({ color: enabled ? '#14B8A6' : '#5C6670' })
  if (chrome.action.setBadgeTextColor) {
    try {
      await chrome.action.setBadgeTextColor({ color: '#FFFFFF' })
    } catch {
      // older Chrome
    }
  }
}

async function setEnabled(enabled) {
  const state = await getState()
  if (enabled) {
    if (!state.proxy) throw new Error('Select a proxy from the list')
    await applyProxySettings(state.proxy)
  } else {
    await clearProxySettings()
  }
  await writeStorage({ enabled: Boolean(enabled) })
  await updateBadge(Boolean(enabled))
  return getState()
}

async function saveProxyString(proxyString, label = undefined) {
  const parsed = parseProxyString(proxyString)
  const cleanLabel = label === undefined ? undefined : String(label || '').trim()
  const state = await getState()
  const key = proxyKey(parsed)
  const existing = state.proxies.find((item) => proxyKey(item) === key)

  let proxies
  let activeId

  if (existing) {
    proxies = state.proxies.map((item) => (
      item.id === existing.id
        ? {
            ...item,
            ...parsed,
            ...(cleanLabel !== undefined ? { label: cleanLabel } : {})
          }
        : item
    ))
    activeId = existing.id
  } else {
    const id = newId()
    proxies = [
      ...state.proxies,
      {
        id,
        ...parsed,
        label: cleanLabel || '',
        lastIp: '',
        country: '',
        countryCode: '',
        pingMs: 0,
        checkedAt: ''
      }
    ]
    activeId = id
  }

  await writeStorage({ proxies, activeId })

  const next = await getState()
  if (next.enabled && next.proxy) {
    await applyProxySettings(next.proxy)
  }
  return next
}

async function renameProxy(id, label) {
  const state = await getState()
  if (!state.proxies.some((item) => item.id === id)) {
    throw new Error('Proxy not found')
  }

  const proxies = state.proxies.map((item) => (
    item.id === id
      ? { ...item, label: String(label || '').trim() }
      : item
  ))

  await writeStorage({ proxies })
  return getState()
}

function splitProxyLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
}

function previewImport(text) {
  const lines = splitProxyLines(text)
  let valid = 0
  let invalid = 0

  for (const line of lines) {
    try {
      const { proxyString } = splitLabelAndProxy(line)
      parseProxyString(proxyString)
      valid += 1
    } catch {
      invalid += 1
    }
  }

  return { total: lines.length, valid, invalid }
}

async function importProxyStrings(text) {
  const lines = splitProxyLines(text)
  if (!lines.length) throw new Error('No proxy lines to import')

  const state = await getState()
  const proxies = [...state.proxies]
  let activeId = state.activeId
  let added = 0
  let updated = 0
  let failed = 0
  const errors = []
  let lastImportedId = null

  for (const line of lines) {
    try {
      const { label, proxyString } = splitLabelAndProxy(line)
      const parsed = parseProxyString(proxyString)
      const key = proxyKey(parsed)
      const index = proxies.findIndex((item) => proxyKey(item) === key)

      if (index >= 0) {
        proxies[index] = {
          ...proxies[index],
          ...parsed,
          ...(label ? { label } : {})
        }
        updated += 1
        lastImportedId = proxies[index].id
      } else {
        const id = newId()
        proxies.push({
          id,
          ...parsed,
          label,
          lastIp: '',
          country: '',
          countryCode: '',
          pingMs: 0,
          checkedAt: ''
        })
        added += 1
        lastImportedId = id
      }
    } catch (err) {
      failed += 1
      errors.push({
        line,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  if (added === 0 && updated === 0) {
    throw new Error(errors[0]?.error || 'No valid proxies to import')
  }

  if (lastImportedId) activeId = lastImportedId

  await writeStorage({ proxies, activeId })

  const next = await getState()
  if (next.enabled && next.proxy) {
    await applyProxySettings(next.proxy)
  }

  return {
    added,
    updated,
    failed,
    errors: errors.slice(0, 5),
    ...next
  }
}

async function selectProxy(id) {
  const state = await getState()
  const proxy = state.proxies.find((item) => item.id === id)
  if (!proxy) throw new Error('Proxy not found')

  await writeStorage({
    activeId: id,
    lastIp: proxy.lastIp || '',
    country: proxy.country || '',
    countryCode: proxy.countryCode || '',
    pingMs: proxy.pingMs || 0,
    lastCheckedAt: proxy.checkedAt || ''
  })

  if (state.enabled) {
    await applyProxySettings(proxy)
  }

  return getState()
}

async function deleteProxy(id) {
  const state = await getState()
  const proxies = state.proxies.filter((item) => item.id !== id)
  let activeId = state.activeId
  let enabled = state.enabled

  if (activeId === id) {
    activeId = proxies[0]?.id || null
    if (!activeId) {
      enabled = false
      await clearProxySettings()
      await updateBadge(false)
    } else if (enabled) {
      const nextActive = proxies.find((item) => item.id === activeId)
      if (nextActive) await applyProxySettings(nextActive)
    }
  }

  const active = proxies.find((item) => item.id === activeId)
  await writeStorage({
    proxies,
    activeId,
    enabled,
    lastIp: active?.lastIp || '',
    country: active?.country || '',
    countryCode: active?.countryCode || '',
    pingMs: active?.pingMs || 0,
    lastCheckedAt: active?.checkedAt || ''
  })

  return getState()
}

async function fetchCountry(ip) {
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      cache: 'no-store'
    })
    if (!res.ok) return { country: '', countryCode: '' }
    const data = await res.json()
    if (!data?.success) return { country: '', countryCode: '' }
    const parts = [data.country, data.city].filter(Boolean)
    return {
      country: parts.join(', '),
      countryCode: String(data.country_code || '').toUpperCase()
    }
  } catch {
    return { country: '', countryCode: '' }
  }
}

async function fetchExitInfo() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const started = Date.now()
    const res = await fetch(IPIFY_URL, {
      cache: 'no-store',
      signal: controller.signal
    })
    const pingMs = Math.max(1, Math.round(Date.now() - started))
    if (!res.ok) throw new Error(`ipify HTTP ${res.status}`)
    const data = await res.json()
    const ip = String(data?.ip || '').trim()
    if (!ip) throw new Error('Empty response from ipify')
    const geo = await fetchCountry(ip)
    const checkedAt = new Date().toISOString()
    return {
      ip,
      country: geo.country,
      countryCode: geo.countryCode,
      pingMs,
      checkedAt
    }
  } finally {
    clearTimeout(timer)
  }
}

async function persistCheckResult(result) {
  const state = await getState()
  const proxies = state.proxies.map((item) => (
    item.id === state.activeId
      ? {
          ...item,
          lastIp: result.ip,
          country: result.country,
          countryCode: result.countryCode,
          pingMs: result.pingMs,
          checkedAt: result.checkedAt
        }
      : item
  ))

  await writeStorage({
    proxies,
    lastIp: result.ip,
    country: result.country,
    countryCode: result.countryCode,
    pingMs: result.pingMs,
    lastCheckedAt: result.checkedAt
  })
}

async function checkProxy() {
  const state = await getState()
  if (!state.proxy) throw new Error('Select a proxy from the list')

  const wasEnabled = state.enabled
  if (!wasEnabled) {
    await applyProxySettings(state.proxy)
    await writeStorage({ enabled: true })
    await updateBadge(true)
  }

  try {
    const result = await fetchExitInfo()
    await persistCheckResult(result)
    return getState()
  } catch (err) {
    if (!wasEnabled) {
      await clearProxySettings()
      await writeStorage({ enabled: false })
      await updateBadge(false)
    }
    throw err
  }
}

async function checkProxyString(proxyString) {
  const parsed = parseProxyString(proxyString)
  const state = await getState()
  const wasEnabled = state.enabled
  const previousProxy = state.proxy

  let result
  try {
    await applyProxySettings(parsed)
    result = await fetchExitInfo()
  } finally {
    if (wasEnabled && previousProxy) {
      await applyProxySettings(previousProxy)
      await updateBadge(true)
    } else {
      await clearProxySettings()
      if (wasEnabled) {
        await writeStorage({ enabled: false })
      }
      await updateBadge(false)
    }
  }

  return {
    proxy: parsed,
    ip: result.ip,
    country: result.country,
    countryCode: result.countryCode,
    pingMs: result.pingMs,
    checkedAt: result.checkedAt
  }
}

async function restoreOnBoot() {
  const data = await loadStorageData()
  if (normalizeProxies(data.proxies).length && !(await readMirrorBackup())) {
    await mirrorBackup(data)
  }

  const state = await getState()
  if (state.enabled && state.proxy) {
    await applyProxySettings(state.proxy)
    await updateBadge(true)
  } else {
    await clearProxySettings()
    await updateBadge(false)
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void restoreOnBoot()
})

chrome.runtime.onStartup.addListener(() => {
  void restoreOnBoot()
})

chrome.webRequest.onAuthRequired.addListener(
  (details, asyncCallback) => {
    void (async () => {
      if (!details.isProxy) {
        asyncCallback({})
        return
      }
      const state = await getState()
      if (!state.proxy?.username) {
        asyncCallback({})
        return
      }
      asyncCallback({
        authCredentials: {
          username: state.proxy.username,
          password: state.proxy.password
        }
      })
    })()
  },
  { urls: ['<all_urls>'] },
  ['asyncBlocking']
)

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const reply = (promise) => {
    promise
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      }))
    return true
  }

  if (message?.type === 'getStatus') {
    return reply((async () => {
      const state = await getState()
      const backup = await getBackupInfo()
      return { ...state, backup }
    })())
  }
  if (message?.type === 'exportBackup') return reply(exportBackup())
  if (message?.type === 'importBackup') return reply(importBackup(message.payload))
  if (message?.type === 'saveProxy') {
    return reply(saveProxyString(message.proxyString, message.label))
  }
  if (message?.type === 'renameProxy') return reply(renameProxy(message.id, message.label))
  if (message?.type === 'importProxies') return reply(importProxyStrings(message.text))
  if (message?.type === 'previewImport') {
    return reply(Promise.resolve(previewImport(message.text)))
  }
  if (message?.type === 'selectProxy') return reply(selectProxy(message.id))
  if (message?.type === 'deleteProxy') return reply(deleteProxy(message.id))
  if (message?.type === 'setEnabled') return reply(setEnabled(Boolean(message.enabled)))
  if (message?.type === 'checkProxy') return reply(checkProxy())
  if (message?.type === 'checkProxyString') {
    return reply(checkProxyString(message.proxyString))
  }
  if (message?.type === 'refreshIp') {
    return reply((async () => {
      const state = await getState()
      if (!state.enabled) throw new Error('Proxy is disabled')
      if (!state.proxy) throw new Error('Select a proxy from the list')
      const result = await fetchExitInfo()
      await persistCheckResult(result)
      return getState()
    })())
  }
  if (message?.type === 'parsePreview') {
    return reply((async () => {
      const proxy = parseProxyString(message.proxyString)
      return { label: formatProxyLabel(proxy), proxy }
    })())
  }

  return false
})
