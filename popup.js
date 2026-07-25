function $(id) {
  return document.getElementById(id)
}

function setText(el, value) {
  if (!el) return
  el.textContent = value
}

const proxyStringEl = $('proxyString')
const proxyLabelEl = $('proxyLabel')
const parsedEl = $('parsed')
const saveEl = $('save')
const checkEl = $('check')
const toggleEl = $('toggle')
const powerStateEl = $('powerState')
const listEl = $('list')
const msgEl = $('msg')
const addAccordionEl = $('addAccordion')
const addToggleEl = $('addToggle')
const statusChipEl = $('statusChip')
const statusFlagEl = $('statusFlag')
const statusTextEl = $('statusText')
const statusPingEl = $('statusPing')
const stringPanelEl = $('stringPanel')
const fieldsFormEl = $('fieldsForm')
const bulkFormEl = $('bulkForm')
const bulkTextEl = $('bulkText')
const modeTabStringEl = $('modeTabString')
const modeTabFieldsEl = $('modeTabFields')
const modeTabBulkEl = $('modeTabBulk')
const modeTabs = [modeTabStringEl, modeTabFieldsEl, modeTabBulkEl].filter(Boolean)
const fieldHostEl = $('fieldHost')
const fieldPortEl = $('fieldPort')
const fieldUserEl = $('fieldUser')
const fieldPassEl = $('fieldPass')
const confirmDialogEl = $('confirmDialog')
const confirmBackdropEl = $('confirmBackdrop')
const confirmTitleEl = $('confirmTitle')
const confirmTextEl = $('confirmText')
const confirmCancelEl = $('confirmCancel')
const confirmOkEl = $('confirmOk')
const exportBackupEl = $('exportBackup')
const importBackupBtnEl = $('importBackupBtn')
const importFileEl = $('importFile')
const backupHintEl = $('backupHint')

const fieldInputs = [fieldHostEl, fieldPortEl, fieldUserEl, fieldPassEl].filter(Boolean)

let inputMode = 'string'
let pendingConfirm = null
let confirmHideTimer = null

function showConfirm({ title, text, okLabel = 'OK', danger = false, onConfirm }) {
  pendingConfirm = onConfirm
  if (confirmTitleEl) confirmTitleEl.textContent = title
  if (confirmTextEl) confirmTextEl.textContent = text
  if (confirmOkEl) {
    confirmOkEl.textContent = okLabel
    confirmOkEl.className = danger ? 'btn btn-danger' : 'btn btn-primary'
  }

  if (confirmHideTimer) {
    clearTimeout(confirmHideTimer)
    confirmHideTimer = null
  }

  confirmDialogEl?.classList.remove('hidden')
  requestAnimationFrame(() => confirmDialogEl?.classList.add('open'))
}

function hideConfirm() {
  pendingConfirm = null
  confirmDialogEl?.classList.remove('open')

  if (confirmHideTimer) clearTimeout(confirmHideTimer)
  confirmHideTimer = setTimeout(() => {
    confirmDialogEl?.classList.add('hidden')
    if (confirmOkEl) confirmOkEl.className = 'btn btn-danger'
    confirmHideTimer = null
  }, 220)
}

function showConfirmDelete(label, onConfirm) {
  showConfirm({
    title: 'Remove proxy?',
    text: label,
    okLabel: 'Remove',
    danger: true,
    onConfirm
  })
}

if (confirmCancelEl) {
  confirmCancelEl.addEventListener('click', () => hideConfirm())
}

if (confirmBackdropEl) {
  confirmBackdropEl.addEventListener('click', () => hideConfirm())
}

if (confirmOkEl) {
  confirmOkEl.addEventListener('click', () => {
    const action = pendingConfirm
    hideConfirm()
    if (action) action()
  })
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && confirmDialogEl?.classList.contains('open')) {
    hideConfirm()
  }
})

function setAccordionOpen(open) {
  if (!addAccordionEl || !addToggleEl) return
  addAccordionEl.classList.toggle('open', open)
  addToggleEl.setAttribute('aria-expanded', open ? 'true' : 'false')
}

if (addToggleEl) {
  addToggleEl.addEventListener('click', () => {
    setAccordionOpen(!addAccordionEl.classList.contains('open'))
  })
}

function send(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...payload }, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      if (!res?.ok) {
        reject(new Error(res?.error || 'Unknown error'))
        return
      }
      resolve(res.data)
    })
  })
}

function showMsg(text, kind) {
  if (!msgEl) return
  msgEl.textContent = text
  msgEl.className = `toast show ${kind}`
}

function clearMsg() {
  if (!msgEl) return
  msgEl.className = 'toast'
  msgEl.textContent = ''
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

function getLabelInputValue() {
  return proxyLabelEl?.value.trim() || ''
}

function formatProxyTitle(item) {
  return item?.label || formatHost(item)
}

function splitProxyLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
}

function formatImportResult(result) {
  const parts = []
  if (result.added) parts.push(`${result.added} added`)
  if (result.updated) parts.push(`${result.updated} updated`)
  if (result.failed) parts.push(`${result.failed} skipped`)
  return parts.join(', ') || 'Imported'
}

async function persistInput() {
  if (inputMode === 'bulk') {
    return send('importProxies', { text: bulkTextEl?.value || '' })
  }
  const { label: embeddedLabel, proxyString } = splitLabelAndProxy(getRawProxyInput())
  const label = getLabelInputValue() || embeddedLabel
  const payload = { proxyString }
  if (label) payload.label = label
  return send('saveProxy', payload)
}

function formatHost(proxy) {
  if (!proxy?.host) return '—'
  return `${proxy.host}:${proxy.port}`
}

function buildProxyString({ host, port, username, password }) {
  const cleanHost = String(host || '').trim()
  const cleanPort = String(port || '').trim()
  const cleanUser = String(username || '').trim()
  const cleanPass = String(password || '').trim()

  if (!cleanHost || !cleanPort) {
    throw new Error('Host and port are required')
  }

  if (cleanUser || cleanPass) {
    return `${cleanHost}:${cleanPort}@${cleanUser}:${cleanPass}`
  }

  return `${cleanHost}:${cleanPort}`
}

function getRawProxyInput() {
  if (inputMode === 'fields') {
    return buildProxyString({
      host: fieldHostEl?.value,
      port: fieldPortEl?.value,
      username: fieldUserEl?.value,
      password: fieldPassEl?.value
    })
  }
  return proxyStringEl?.value.trim() || ''
}

function getProxyInputValue() {
  if (inputMode === 'fields') {
    return getRawProxyInput()
  }
  return splitLabelAndProxy(proxyStringEl?.value.trim() || '').proxyString
}

function clearProxyInputs() {
  if (proxyStringEl) proxyStringEl.value = ''
  if (proxyLabelEl) proxyLabelEl.value = ''
  if (bulkTextEl) bulkTextEl.value = ''
  fieldInputs.forEach((input) => { input.value = '' })
  clearParsedHint()
}

function setInputMode(mode) {
  const nextMode = ['string', 'fields', 'bulk'].includes(mode) ? mode : 'string'
  inputMode = nextMode

  if (stringPanelEl) stringPanelEl.classList.toggle('hidden', nextMode !== 'string')
  if (fieldsFormEl) fieldsFormEl.classList.toggle('hidden', nextMode !== 'fields')
  if (bulkFormEl) bulkFormEl.classList.toggle('hidden', nextMode !== 'bulk')

  modeTabs.forEach((tab) => {
    const active = (
      (nextMode === 'string' && tab === modeTabStringEl)
      || (nextMode === 'fields' && tab === modeTabFieldsEl)
      || (nextMode === 'bulk' && tab === modeTabBulkEl)
    )
    tab.classList.toggle('active', active)
    tab.setAttribute('aria-selected', active ? 'true' : 'false')
  })

  if (checkEl) checkEl.hidden = nextMode === 'bulk'
  if (saveEl) saveEl.textContent = nextMode === 'bulk' ? 'Import' : 'Save'

  void refreshParsed()
}

function switchInputMode(mode) {
  if (mode === inputMode) return

  if (mode === 'fields') {
    void syncFieldsFromString().then(() => setInputMode('fields'))
    return
  }

  if (inputMode === 'fields') {
    syncStringFromFields()
  }

  if (mode === 'bulk') {
    const line = proxyStringEl?.value.trim()
    const label = getLabelInputValue()
    if (line && bulkTextEl && !bulkTextEl.value.trim()) {
      bulkTextEl.value = label && !line.includes(' :: ') ? `${label} :: ${line}` : line
    }
  }

  setInputMode(mode)
}

async function syncFieldsFromString() {
  const { proxyString } = splitLabelAndProxy(proxyStringEl?.value.trim() || '')
  if (proxyStringEl?.value.includes(' :: ') && proxyLabelEl) {
    const { label } = splitLabelAndProxy(proxyStringEl.value)
    if (label) proxyLabelEl.value = label
  }

  if (!proxyString) {
    fieldInputs.forEach((input) => { input.value = '' })
    return
  }

  try {
    const data = await send('parsePreview', { proxyString })
    if (fieldHostEl) fieldHostEl.value = data.proxy.host || ''
    if (fieldPortEl) fieldPortEl.value = data.proxy.port ? String(data.proxy.port) : ''
    if (fieldUserEl) fieldUserEl.value = data.proxy.username || ''
    if (fieldPassEl) fieldPassEl.value = data.proxy.password || ''
  } catch {
    // keep whatever is already in the fields
  }
}

function syncStringFromFields() {
  if (!proxyStringEl) return
  try {
    proxyStringEl.value = buildProxyString({
      host: fieldHostEl?.value,
      port: fieldPortEl?.value,
      username: fieldUserEl?.value,
      password: fieldPassEl?.value
    })
  } catch {
    // leave the string input unchanged
  }
}

function flagEmoji(code) {
  const cc = String(code || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return ''
  return String.fromCodePoint(
    ...[...cc].map((char) => 127397 + char.charCodeAt(0))
  )
}

function renderStatusChip(state) {
  if (!statusChipEl || !statusTextEl) return

  const live = Boolean(state.enabled && state.lastIp)
  statusChipEl.className = live ? 'status-chip live' : 'status-chip'

  const flag = flagEmoji(state.countryCode)
  if (statusFlagEl) {
    statusFlagEl.textContent = flag
    statusFlagEl.hidden = !flag
  }

  if (!state.enabled) {
    setText(statusTextEl, 'off')
    setText(statusPingEl, '')
    if (statusFlagEl) statusFlagEl.hidden = true
    return
  }

  if (!state.lastIp) {
    setText(statusTextEl, 'connecting…')
    setText(statusPingEl, '')
    return
  }

  const bits = []
  const cc = String(state.countryCode || '').trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(cc)) bits.push(cc)
  const label = String(state.proxy?.label || '').trim()
  bits.push(label || state.lastIp)
  setText(statusTextEl, bits.join(' · '))
  setText(statusPingEl, state.pingMs ? `${state.pingMs} ms` : '')
}

function buildItemMetaParts(item, state) {
  const bits = []
  const flag = flagEmoji(item.countryCode)
  if (flag || item.country) bits.push([flag, item.country].filter(Boolean).join(' '))
  else if (item.lastIp) bits.push(item.lastIp)
  if (item.pingMs) bits.push(`${item.pingMs} ms`)
  return {
    text: bits.join(' · ') || 'not checked',
    active: item.id === state.activeId
  }
}

function fillItemMeta(metaEl, item, state) {
  metaEl.replaceChildren()
  const { text, active } = buildItemMetaParts(item, state)

  const textEl = document.createElement('span')
  textEl.className = 'item-meta-text'
  textEl.textContent = text
  metaEl.appendChild(textEl)

  if (active) {
    const mark = document.createElement('span')
    mark.className = 'item-active-mark'
    mark.title = 'Active'
    mark.setAttribute('aria-label', 'Active')
    metaEl.appendChild(mark)
  }
}

function startRename(item, titleEl, mainEl) {
  if (mainEl.dataset.renaming === '1') return
  mainEl.dataset.renaming = '1'

  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'item-rename-input'
  input.value = item.label || ''
  input.placeholder = formatHost(item)
  input.setAttribute('aria-label', 'Proxy name')
  input.spellcheck = false
  input.autocomplete = 'off'

  titleEl.replaceWith(input)
  input.focus()
  input.select()

  let done = false
  const cleanup = () => {
    document.removeEventListener('pointerdown', onPointerDown, true)
  }

  const finish = async (save) => {
    if (done) return
    done = true
    cleanup()
    delete mainEl.dataset.renaming

    if (save) {
      try {
        const next = await send('renameProxy', { id: item.id, label: input.value.trim() })
        render(next)
      } catch (err) {
        showMsg(err instanceof Error ? err.message : String(err), 'err')
        render(await send('getStatus'))
      }
      return
    }

    const restored = document.createElement('div')
    restored.className = 'item-title'
    restored.textContent = formatProxyTitle(item)
    restored.title = item.label ? 'Double-click to rename' : 'Double-click to add a name'
    restored.addEventListener('dblclick', (event) => {
      event.preventDefault()
      event.stopPropagation()
      startRename(item, restored, mainEl)
    })
    input.replaceWith(restored)
  }

  const onPointerDown = (event) => {
    if (event.target === input || input.contains(event.target)) return
    void finish(true)
  }

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      void finish(true)
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      void finish(false)
    }
  })
  input.addEventListener('click', (event) => event.stopPropagation())
  input.addEventListener('pointerdown', (event) => event.stopPropagation())

  document.addEventListener('pointerdown', onPointerDown, true)
}

function renderList(state) {
  if (!listEl) return
  listEl.innerHTML = ''
  if (!state.proxies?.length) {
    const empty = document.createElement('div')
    empty.className = 'empty'
    empty.textContent = 'No proxies yet'
    listEl.appendChild(empty)
    return
  }

  state.proxies.forEach((item, index) => {
    const row = document.createElement('div')
    row.className = `item${item.id === state.activeId ? ' active' : ''}`
    row.style.animationDelay = `${Math.min(index, 6) * 40}ms`

    const main = document.createElement('div')
    main.className = 'item-main'
    main.setAttribute('role', 'button')
    main.tabIndex = 0

    const title = document.createElement('div')
    title.className = 'item-title'
    title.textContent = formatProxyTitle(item)
    title.title = item.label ? 'Double-click to rename' : 'Double-click to add a name'
    title.addEventListener('dblclick', (event) => {
      event.preventDefault()
      event.stopPropagation()
      startRename(item, title, main)
    })

    const meta = document.createElement('div')
    meta.className = 'item-meta'
    fillItemMeta(meta, item, state)

    main.append(title, meta)

    const selectItem = () => {
      if (main.dataset.renaming === '1') return
      void withBusy(async () => {
        clearMsg()
        try {
          let next = await send('selectProxy', { id: item.id })
          if (next.enabled) {
            next = await send('refreshIp')
          } else {
            showMsg(`Selected ${formatProxyTitle(item)}`, 'ok')
          }
          render(next)
        } catch (err) {
          showMsg(err instanceof Error ? err.message : String(err), 'err')
        }
      })
    }

    main.addEventListener('click', selectItem)
    main.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        if (main.dataset.renaming === '1') return
        event.preventDefault()
        selectItem()
      }
    })

    const actions = document.createElement('div')
    actions.className = 'item-actions'

    const edit = document.createElement('button')
    edit.type = 'button'
    edit.className = 'item-edit'
    edit.textContent = '✎'
    edit.title = 'Rename'
    edit.addEventListener('click', (event) => {
      event.stopPropagation()
      startRename(item, title, main)
    })

    const del = document.createElement('button')
    del.type = 'button'
    del.className = 'item-del'
    del.textContent = '✕'
    del.title = 'Remove'
    del.addEventListener('click', (event) => {
      event.stopPropagation()
      const label = formatProxyTitle(item)
      showConfirmDelete(label, () => {
        void withBusy(async () => {
          clearMsg()
          try {
            const next = await send('deleteProxy', { id: item.id })
            render(next)
            showMsg('Removed', 'ok')
          } catch (err) {
            showMsg(err instanceof Error ? err.message : String(err), 'err')
          }
        })
      })
    })

    actions.append(edit, del)
    row.append(main, actions)
    listEl.appendChild(row)
  })
}

function renderBackupHint(state) {
  if (!backupHintEl) return
  const backup = state.backup
  if (!backup?.savedAt || !backup.count) {
    backupHintEl.textContent = 'Auto-backup on save'
    backupHintEl.title = 'Backup runs on every save'
    return
  }
  const when = new Date(backup.savedAt)
  const short = Number.isNaN(when.getTime())
    ? backup.savedAt
    : when.toLocaleString(undefined, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  const source = backup.source === 'sync' ? 'sync' : 'local'
  backupHintEl.textContent = `${short} · ${backup.count} · ${source}`
  backupHintEl.title = `Last backup: ${when.toLocaleString()} · ${backup.count} proxies · ${source}`
}

function render(state) {
  if (toggleEl) {
    toggleEl.className = state.enabled ? 'switch on' : 'switch off'
    toggleEl.setAttribute('aria-checked', state.enabled ? 'true' : 'false')
    toggleEl.setAttribute('aria-label', state.enabled ? 'Disable proxy' : 'Enable proxy')
    toggleEl.disabled = !state.proxy && !state.enabled
  }

  if (powerStateEl) {
    if (!state.proxy && !state.enabled) {
      powerStateEl.textContent = 'No proxy selected'
      powerStateEl.className = 'power-state'
    } else if (state.enabled) {
      powerStateEl.textContent = 'Connected'
      powerStateEl.className = 'power-state live'
    } else {
      powerStateEl.textContent = 'Off'
      powerStateEl.className = 'power-state'
    }
  }

  renderList(state)
  renderStatusChip(state)
  renderBackupHint(state)
}

function clearParsedHint() {
  if (!parsedEl) return
  parsedEl.textContent = ''
  parsedEl.className = 'hint'
}

async function refreshParsed() {
  if (!parsedEl) return

  if (inputMode === 'bulk') {
    const text = bulkTextEl?.value || ''
    if (!splitProxyLines(text).length) {
      clearParsedHint()
      return
    }
    try {
      const data = await send('previewImport', { text })
      parsedEl.textContent = `${data.valid} valid${data.invalid ? ` · ${data.invalid} invalid` : ''}`
      parsedEl.className = data.invalid ? 'hint bad' : 'hint ok'
    } catch (err) {
      parsedEl.textContent = err instanceof Error ? err.message : String(err)
      parsedEl.className = 'hint bad'
    }
    return
  }

  let value = ''
  try {
    value = getProxyInputValue()
  } catch (err) {
    parsedEl.textContent = err instanceof Error ? err.message : String(err)
    parsedEl.className = 'hint bad'
    return
  }

  if (!value) {
    clearParsedHint()
    return
  }

  try {
    const data = await send('parsePreview', { proxyString: value })
    const label = getLabelInputValue()
      || splitLabelAndProxy(proxyStringEl?.value.trim() || '').label
    parsedEl.textContent = label ? `${label} · ${formatHost(data.proxy)}` : formatHost(data.proxy)
    parsedEl.className = 'hint ok'
  } catch (err) {
    parsedEl.textContent = err instanceof Error ? err.message : String(err)
    parsedEl.className = 'hint bad'
  }
}

async function withBusy(fn) {
  document.body.classList.add('busy')
  const buttons = [saveEl, checkEl, toggleEl, ...modeTabs].filter(Boolean)
  buttons.forEach((b) => { b.disabled = true })
  try {
    await fn()
  } finally {
    document.body.classList.remove('busy')
    buttons.forEach((b) => { b.disabled = false })
  }
}

function hasProxyInput() {
  if (inputMode === 'bulk') return splitProxyLines(bulkTextEl?.value).length > 0
  try {
    return Boolean(getProxyInputValue())
  } catch {
    return false
  }
}

if (modeTabStringEl) {
  modeTabStringEl.addEventListener('click', () => switchInputMode('string'))
}

if (modeTabFieldsEl) {
  modeTabFieldsEl.addEventListener('click', () => switchInputMode('fields'))
}

if (modeTabBulkEl) {
  modeTabBulkEl.addEventListener('click', () => switchInputMode('bulk'))
}

if (saveEl) {
  saveEl.addEventListener('click', () => {
    void withBusy(async () => {
      clearMsg()
      try {
        const result = await persistInput()
        clearProxyInputs()
        setAccordionOpen(false)
        render(result)
        if (inputMode === 'bulk') {
          showMsg(formatImportResult(result), result.failed ? 'err' : 'ok')
        } else {
          showMsg('Saved', 'ok')
        }
      } catch (err) {
        showMsg(err instanceof Error ? err.message : String(err), 'err')
      }
    })
  })
}

function formatCheckResult(result) {
  if (!result?.ip) return 'Check failed'
  const bits = [result.ip]
  if (result.country) bits.push(result.country)
  const summary = bits.join(' · ')
  return result.pingMs ? `${summary} · ${result.pingMs} ms` : summary
}

if (checkEl) {
  checkEl.addEventListener('click', () => {
    void withBusy(async () => {
      clearMsg()
      try {
        if (hasProxyInput()) {
          const result = await send('checkProxyString', { proxyString: getProxyInputValue() })
          if (parsedEl) {
            parsedEl.textContent = formatCheckResult(result)
            parsedEl.className = 'hint ok'
          }
          showMsg(`OK: ${formatCheckResult(result)}`, 'ok')
          return
        }

        const state = await send('checkProxy')
        render(state)
        showMsg('Check complete', 'ok')
      } catch (err) {
        showMsg(err instanceof Error ? err.message : String(err), 'err')
        const state = await send('getStatus').catch(() => null)
        if (state) render(state)
      }
    })
  })
}

if (toggleEl) {
  toggleEl.addEventListener('click', () => {
    void withBusy(async () => {
      clearMsg()
      try {
        const current = await send('getStatus')
        const nextEnabled = !current.enabled
        if (nextEnabled && hasProxyInput()) {
          await persistInput()
          clearProxyInputs()
          setAccordionOpen(false)
        }
        let state = await send('setEnabled', { enabled: nextEnabled })
        if (nextEnabled) {
          state = await send('refreshIp')
        }
        render(state)
      } catch (err) {
        showMsg(err instanceof Error ? err.message : String(err), 'err')
      }
    })
  })
}

if (proxyStringEl) {
  proxyStringEl.addEventListener('input', () => {
    const { label } = splitLabelAndProxy(proxyStringEl.value)
    if (label && proxyLabelEl) proxyLabelEl.value = label
    void refreshParsed()
  })
}

if (proxyLabelEl) {
  proxyLabelEl.addEventListener('input', () => {
    if (inputMode !== 'bulk') void refreshParsed()
  })
}

fieldInputs.forEach((input) => {
  input.addEventListener('input', () => {
    if (inputMode === 'fields') void refreshParsed()
  })
})

if (bulkTextEl) {
  bulkTextEl.addEventListener('input', () => {
    if (inputMode === 'bulk') void refreshParsed()
  })
}

if (exportBackupEl) {
  exportBackupEl.addEventListener('click', () => {
    void withBusy(async () => {
      clearMsg()
      try {
        const data = await send('exportBackup')
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const stamp = new Date().toISOString().slice(0, 10)
        const link = document.createElement('a')
        link.href = url
        link.download = `mirror-proxy-backup-${stamp}.json`
        link.click()
        URL.revokeObjectURL(url)
        showMsg('Backup exported', 'ok')
      } catch (err) {
        showMsg(err instanceof Error ? err.message : String(err), 'err')
      }
    })
  })
}

if (importBackupBtnEl && importFileEl) {
  importBackupBtnEl.addEventListener('click', () => importFileEl.click())

  importFileEl.addEventListener('change', () => {
    const file = importFileEl.files?.[0]
    importFileEl.value = ''
    if (!file) return

    showConfirm({
      title: 'Import backup?',
      text: 'This replaces the current proxy list.',
      okLabel: 'Import',
      danger: false,
      onConfirm: () => {
        void withBusy(async () => {
          clearMsg()
          try {
            const text = await file.text()
            const payload = JSON.parse(text)
            const state = await send('importBackup', { payload })
            render(state)
            showMsg('Backup imported', 'ok')
          } catch (err) {
            showMsg(err instanceof Error ? err.message : String(err), 'err')
          }
        })
      }
    })
  })
}

void (async () => {
  try {
    const state = await send('getStatus')
    render(state)
    await refreshParsed()
    if (!state.proxies?.length) {
      setAccordionOpen(true)
    }
    if (state.enabled && state.proxy && (!state.lastIp || !state.country || !state.pingMs)) {
      const refreshed = await send('refreshIp')
      render(refreshed)
    }
  } catch (err) {
    showMsg(err instanceof Error ? err.message : String(err), 'err')
  }
})()
