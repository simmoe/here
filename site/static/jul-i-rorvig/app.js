// Konfiguration til fælles synkronisering (valgfrit)
// 1. 'local': Gemmer lokalt i browseren (virker med det samme)
// 2. 'google-sheets': Indsæt din Google Apps Script Web App URL herunder for fælles synk i Google Drive
const CONFIG = {
  syncMode: 'local',
  googleScriptUrl: '',
  storageKey: 'jul_rorvig_2027_state_v1',
  splashSeenKey: 'jul_rorvig_2027_splash_seen_v2'
}

const DEFAULT_STATE = {
  afternoon: [
    { id: 'af-1', text: 'Pille kartofler', done: false },
    { id: 'af-2', text: 'Snitte rødkål', done: false },
    { id: 'af-3', text: 'Skære appelsiner til salat', done: false },
    { id: 'af-4', text: 'Fylde slik i juletræ', done: false },
    { id: 'af-5', text: 'Lave risalamande', done: false },
    { id: 'af-6', text: 'Dække bord', done: false },
    { id: 'af-7', text: 'Folde servietter', done: false },
    { id: 'af-8', text: 'Lægge julegaver under træet', done: false }
  ],
  simon: [
    { id: 'si-1', text: 'Frokost (leverpostej, æg, tun, rugbrød — ikke sild!)', done: false },
    { id: 'si-2', text: 'Natmad (leverpostej, spegepølse, skæreost, rugbrød)', done: false },
    { id: 'si-3', text: 'Rødkål', done: false },
    { id: 'si-4', text: 'Piskefløde', done: false },
    { id: 'si-5', text: 'Sodavand, øl & saft', done: false },
    { id: 'si-6', text: 'Sanghæfte', done: false },
    { id: 'si-7', text: 'Bad', done: false }
  ],
  tobias: [
    { id: 'to-1', text: 'Kød (2 ænder + ekstra andebryst & flæskesteg)', done: false },
    { id: 'to-2', text: 'Kartofler (almindelige & søde)', done: false },
    { id: 'to-3', text: 'Fond', done: false }
  ],
  nynne: [
    { id: 'ny-1', text: 'Juletræ (hente & pynte)', done: false },
    { id: 'ny-2', text: 'Slik og nødder', done: false },
    { id: 'ny-3', text: 'Appelsinsalat', done: false },
    { id: 'ny-4', text: 'Risalamande & mandelgave', done: false },
    { id: 'ny-5', text: 'Rødvin & gløgg', done: false }
  ],
  ida: [
    { id: 'id-1', text: 'Laks til julefrokosten', done: false },
    { id: 'id-2', text: 'Spiseæbler', done: false },
    { id: 'id-3', text: 'Lægge hus og julestemning til i Rørvig', done: false }
  ],
  packing: [
    { id: 'pa-1', text: '3 Gnau-gaver pr. mand', done: false },
    { id: 'pa-2', text: 'Dyner + lagen', done: false },
    { id: 'pa-3', text: 'Håndklæder', done: false },
    { id: 'pa-4', text: 'Varmt tøj til gåtur ved vandet', done: false }
  ]
}

let state = loadLocalState()

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE))
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey)
    if (!raw) return cloneDefaultState()
    const parsed = JSON.parse(raw)
    return { ...cloneDefaultState(), ...parsed }
  } catch (err) {
    return cloneDefaultState()
  }
}

function setSyncStatus(label) {
  const badge = document.getElementById('sync-status')
  if (badge) badge.textContent = label
}

async function saveState() {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(state))
  } catch (err) {
    // Ignorer hvis localStorage er blokeret
  }

  if (CONFIG.syncMode === 'google-sheets' && CONFIG.googleScriptUrl) {
    setSyncStatus('Gemmer...')
    try {
      await fetch(CONFIG.googleScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(state)
      })
      setSyncStatus('Synkroniseret')
    } catch (err) {
      setSyncStatus('Offline (gemt lokalt)')
    }
  } else {
    setSyncStatus('Gemt lokalt')
  }
}

async function fetchRemoteState() {
  if (CONFIG.syncMode !== 'google-sheets' || !CONFIG.googleScriptUrl) return
  setSyncStatus('Henter...')
  try {
    const res = await fetch(CONFIG.googleScriptUrl)
    const data = await res.json()
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      state = { ...cloneDefaultState(), ...data }
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(state))
      renderAllLists()
    }
    setSyncStatus('Synkroniseret')
  } catch (err) {
    setSyncStatus('Offline (gemt lokalt)')
  }
}

function renderList(listKey) {
  const ul = document.querySelector(`[data-list="${listKey}"]`)
  const counter = document.querySelector(`[data-count-for="${listKey}"]`)
  if (!ul) return

  const items = state[listKey] || []
  ul.innerHTML = ''

  items.forEach((item) => {
    const li = document.createElement('li')
    li.className = item.done ? 'checklist-item is-done' : 'checklist-item'

    const label = document.createElement('label')
    label.className = 'checklist-label'

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = Boolean(item.done)
    checkbox.addEventListener('change', () => {
      item.done = checkbox.checked
      renderList(listKey)
      saveState()
    })

    const span = document.createElement('span')
    span.className = 'checklist-text'
    span.textContent = item.text

    label.appendChild(checkbox)
    label.appendChild(span)

    const delBtn = document.createElement('button')
    delBtn.type = 'button'
    delBtn.className = 'delete-btn'
    delBtn.setAttribute('aria-label', `Fjern ${item.text}`)
    delBtn.textContent = '×'
    delBtn.addEventListener('click', () => {
      state[listKey] = state[listKey].filter((entry) => entry.id !== item.id)
      renderList(listKey)
      saveState()
    })

    li.appendChild(label)
    li.appendChild(delBtn)
    ul.appendChild(li)
  })

  if (counter) {
    const doneCount = items.filter((item) => item.done).length
    counter.textContent = `${doneCount} / ${items.length}`
  }
}

function renderAllLists() {
  Object.keys(DEFAULT_STATE).forEach((key) => renderList(key))
}

function initForms() {
  const forms = document.querySelectorAll('.add-form')
  forms.forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const listKey = form.getAttribute('data-add-for')
      const input = form.querySelector('input')
      const text = input ? input.value.trim() : ''
      if (!text || !listKey) return

      state[listKey].push({
        id: `${listKey}-${Date.now()}`,
        text,
        done: false
      })
      input.value = ''
      renderList(listKey)
      saveState()
    })
  })
}

function initSplashVideo() {
  const overlay = document.getElementById('splash-overlay')
  const video = document.getElementById('splash-video')
  const muteBtn = document.getElementById('splash-mute-btn')
  const skipBtn = document.getElementById('splash-skip-btn')
  const replayBtn = document.getElementById('replay-intro-btn')

  if (!overlay || !video) return

  function closeSplash() {
    localStorage.setItem(CONFIG.splashSeenKey, '1')
    overlay.classList.add('is-fading')
    window.setTimeout(() => {
      overlay.classList.add('hidden')
      overlay.classList.remove('is-fading')
      video.pause()
    }, 600)
  }

  function updateMuteLabel() {
    if (!muteBtn) return
    muteBtn.textContent = video.muted ? 'Slå lyd til' : 'Lyd fra'
  }

  function openSplash({ withSound }) {
    overlay.classList.remove('hidden', 'is-fading')
    video.classList.remove('hidden')
    try { video.currentTime = 0 } catch (err) {}
    video.muted = !withSound
    updateMuteLabel()
    const playPromise = video.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        video.muted = true
        updateMuteLabel()
        video.play().catch(() => {})
      })
    }
  }

  video.addEventListener('ended', closeSplash)

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      video.muted = !video.muted
      updateMuteLabel()
    })
  }

  if (skipBtn) {
    skipBtn.addEventListener('click', closeSplash)
  }

  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      openSplash({ withSound: true })
    })
  }

  const alreadySeen = localStorage.getItem(CONFIG.splashSeenKey) === '1'
  if (!alreadySeen) {
    openSplash({ withSound: false })
  }
}

function initActions() {
  const printBtn = document.getElementById('print-btn')
  if (printBtn) {
    printBtn.addEventListener('click', () => window.print())
  }

  const resetBtn = document.getElementById('reset-btn')
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      state = cloneDefaultState()
      renderAllLists()
      saveState()
    })
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderAllLists()
  initForms()
  initActions()
  initSplashVideo()
  fetchRemoteState()
})
