const CONFIG = {
  splashSeenKey: 'jul_rorvig_2027_splash_seen_v2'
}

firebase.initializeApp({
  apiKey: 'AIzaSyDU1QQ5IOx65YauKjemsexCpfgNBblrQRc',
  authDomain: 'p5-firebase-eebc1.firebaseapp.com',
  projectId: 'p5-firebase-eebc1',
  storageBucket: 'p5-firebase-eebc1.appspot.com',
  messagingSenderId: '757530790495',
  appId: '1:757530790495:web:3b63a4a12d2afdad97e9ea'
})

const planRef = firebase.firestore().collection('here_jul').doc('rorvig')

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
    { id: 'si-1', text: 'Frokost (leverpostej, æg, tun, rugbrød)', done: false },
    { id: 'si-8', text: 'Sild og dild', done: false },
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

let state = cloneDefaultState()
let saveDepth = 0
let saveChain = Promise.resolve()

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE))
}

function cleanItem(item) {
  if (!item || typeof item.id !== 'string' || typeof item.text !== 'string') return null
  return { id: item.id, text: item.text, done: !!item.done }
}

function normalizeState(parsed) {
  const next = cloneDefaultState()
  if (!parsed || typeof parsed !== 'object') return next
  for (const key of Object.keys(DEFAULT_STATE)) {
    if (!Array.isArray(parsed[key])) continue
    next[key] = parsed[key].map(cleanItem).filter(Boolean)
  }
  return next
}

function setSyncStatus(label) {
  const badge = document.getElementById('sync-status')
  if (badge) badge.textContent = label
}

function watchPlan() {
  planRef.onSnapshot((snap) => {
    if (saveDepth > 0) return
    if (!snap.exists) {
      state = cloneDefaultState()
      renderAllLists()
      saveState(null)
      return
    }
    state = normalizeState(snap.data().state)
    renderAllLists()
    setSyncStatus('Fælles')
  }, () => setSyncStatus('Ikke gemt'))
}

function saveState(changedKey) {
  const localLists = JSON.parse(JSON.stringify(state))
  setSyncStatus('Gemmer…')
  saveDepth += 1
  saveChain = saveChain.then(async () => {
    try {
      const next = await firebase.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(planRef)
        const current = snap.exists ? normalizeState(snap.data().state) : cloneDefaultState()
        if (changedKey) current[changedKey] = localLists[changedKey]
        else {
          for (const key of Object.keys(DEFAULT_STATE)) current[key] = localLists[key]
        }
        tx.set(planRef, { state: current })
        return current
      })
      state = next
      renderAllLists()
      setSyncStatus('Fælles')
    } catch (err) {
      setSyncStatus('Ikke gemt')
    } finally {
      saveDepth -= 1
    }
  })
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
      saveState(listKey)
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
      saveState(listKey)
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
      saveState(listKey)
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
      saveState(null)
    })
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderAllLists()
  initForms()
  initActions()
  initSplashVideo()
  watchPlan()
})
