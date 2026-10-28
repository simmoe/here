import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
    browserLocalPersistence,
    getAuth,
    getRedirectResult,
    GoogleAuthProvider,
    onAuthStateChanged,
    setPersistence,
    signInWithRedirect,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getFirestore,
    onSnapshot,
    serverTimestamp,
    updateDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const AUTHORIZED_EMAIL = 'simmoe@gmail.com';

const firebaseConfig = {
    apiKey: "AIzaSyDU1QQ5IOx65YauKjemsexCpfgNBblrQRc",
    authDomain: "p5-firebase-eebc1.firebaseapp.com",
    projectId: "p5-firebase-eebc1",
    appId: "1:757530790495:web:3b63a4a12d2afdad97e9ea"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

const gate = document.querySelector('#gate');
const gateText = document.querySelector('#gate-text');
const appSection = document.querySelector('#app');
const statusEl = document.querySelector('#status');
const classNav = document.querySelector('#class-nav');
const classView = document.querySelector('#class-view');
const notesEl = document.querySelector('#notes');

setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error(error);
});

getRedirectResult(auth).catch((error) => {
    console.error(error);
    gateText.textContent = 'Login fejlede: ' + (error.code || error.message);
});

const state = {
    classes: [],
    students: new Map(),
    enrollments: [],
    selectedClassId: null
};

const saveTimers = new Map();
let unsubs = [];
let listening = false;

document.querySelector('#login').addEventListener('click', async () => {
    gateText.textContent = 'Sender dig til Google…';
    try {
        await signInWithRedirect(auth, provider);
    } catch (error) {
        console.error(error);
        gateText.textContent = 'Login fejlede: ' + (error.code || error.message);
    }
});

document.querySelector('#logout').addEventListener('click', () => signOut(auth));
document.querySelector('#note-cancel').addEventListener('click', resetNoteForm);

document.querySelector('#note-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.querySelector('#note-id').value;
    const data = {
        title: document.querySelector('#note-title').value.trim(),
        body: document.querySelector('#note-body').value.trim(),
        updatedAt: serverTimestamp()
    };
    if (id) {
        await updateDoc(doc(db, 'here_private_notes', id), data);
    } else {
        await addDoc(collection(db, 'here_private_notes'), data);
    }
    resetNoteForm();
});

function resetNoteForm() {
    document.querySelector('#note-form').reset();
    document.querySelector('#note-id').value = '';
    document.querySelector('#note-cancel').hidden = true;
}

function render() {
    const classes = [...state.classes].sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!state.selectedClassId && classes[0]) state.selectedClassId = classes[0].id;

    classNav.replaceChildren();
    classes.forEach((item) => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'tab' + (item.id === state.selectedClassId ? ' active' : '');
        tab.textContent = item.title;
        tab.addEventListener('click', () => {
            state.selectedClassId = item.id;
            render();
        });
        classNav.appendChild(tab);
    });

    const current = classes.find((item) => item.id === state.selectedClassId);
    classView.replaceChildren();
    if (!current) return;

    const heading = document.createElement('h2');
    heading.textContent = current.title;
    classView.appendChild(heading);

    const about = document.createElement('p');
    about.className = 'meta';
    about.textContent = [current.year, current.subject, current.level].filter(Boolean).join(' · ');
    classView.appendChild(about);

    const rows = state.enrollments
        .filter((item) => item.classId === current.id)
        .map((enrollment) => ({
            enrollment,
            student: state.students.get(enrollment.studentId)
        }))
        .sort((a, b) => (a.student?.name || '').localeCompare(b.student?.name || '', 'da'));

    rows.forEach(({ enrollment, student }) => {
        const card = document.createElement('article');
        card.className = 'student';

        const name = document.createElement('h3');
        name.textContent = student?.name || 'Ukendt elev';
        card.appendChild(name);

        const meta = document.createElement('p');
        meta.className = 'meta';
        meta.textContent = [
            student?.birthDate ? formatDate(student.birthDate) : '',
            enrollment.studyLine || '',
            (enrollment.groups || []).join(', ')
        ].filter(Boolean).join(' · ');
        card.appendChild(meta);

        (current.fields || []).forEach((field) => {
            const label = document.createElement('label');
            const caption = document.createElement('span');
            caption.textContent = field.label;
            const input = document.createElement('textarea');
            input.rows = 3;
            input.value = enrollment.values?.[field.key] || '';
            input.addEventListener('input', () => scheduleSave(enrollment.id, field.key, input.value));
            label.append(caption, input);
            card.appendChild(label);
        });

        classView.appendChild(card);
    });
}

function scheduleSave(enrollmentId, key, value) {
    const timerKey = enrollmentId + ':' + key;
    clearTimeout(saveTimers.get(timerKey));
    statusEl.textContent = 'Gemmer…';
    saveTimers.set(timerKey, setTimeout(async () => {
        try {
            await updateDoc(doc(db, 'here_private_enrollments', enrollmentId), {
                [`values.${key}`]: value,
                updatedAt: serverTimestamp()
            });
            statusEl.textContent = 'Gemt';
        } catch (error) {
            statusEl.textContent = error?.code === 'permission-denied'
                ? 'Kunne ikke gemme. Reglerne er ikke slået til endnu.'
                : 'Kunne ikke gemme.';
        }
    }, 500));
}

function formatDate(iso) {
    const [year, month, day] = iso.split('-');
    if (!day) return iso;
    return `${day}.${month}.${year}`;
}

function renderNotes(docs) {
    notesEl.replaceChildren();
    docs.forEach((item) => {
        const card = document.createElement('article');
        card.className = 'card';
        const title = document.createElement('h3');
        title.textContent = item.title || 'Uden titel';
        const body = document.createElement('p');
        body.textContent = item.body || '';
        const row = document.createElement('div');
        row.className = 'row';
        row.append(
            button('Ret', 'secondary', () => {
                document.querySelector('#note-id').value = item.id;
                document.querySelector('#note-title').value = item.title || '';
                document.querySelector('#note-body').value = item.body || '';
                document.querySelector('#note-cancel').hidden = false;
            }),
            button('Slet', 'secondary', () => deleteDoc(doc(db, 'here_private_notes', item.id)))
        );
        card.append(title, body, row);
        notesEl.appendChild(card);
    });
}

function button(label, className, onClick) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = className;
    el.textContent = label;
    el.addEventListener('click', onClick);
    return el;
}

function watch(path, onNext) {
    const unsub = onSnapshot(collection(db, path), onNext, (error) => {
        statusEl.textContent = error?.code === 'permission-denied'
            ? 'Adgang mangler. Reglerne er ikke slået til endnu.'
            : 'Kunne ikke hente data.';
    });
    unsubs.push(unsub);
}

function startListening() {
    if (listening) return;
    listening = true;
    watch('here_private_classes', (snap) => {
        state.classes = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
        render();
    });
    watch('here_private_students', (snap) => {
        state.students = new Map(snap.docs.map((item) => [item.id, { id: item.id, ...item.data() }]));
        render();
    });
    watch('here_private_enrollments', (snap) => {
        state.enrollments = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
        render();
    });
    watch('here_private_notes', (snap) => {
        const docs = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
        docs.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
        renderNotes(docs);
    });
}

function stopListening() {
    unsubs.forEach((unsub) => unsub());
    unsubs = [];
    listening = false;
    state.classes = [];
    state.students = new Map();
    state.enrollments = [];
    classNav.replaceChildren();
    classView.replaceChildren();
    notesEl.replaceChildren();
}

onAuthStateChanged(auth, async (user) => {
    if (user && user.email === AUTHORIZED_EMAIL) {
        gate.hidden = true;
        appSection.hidden = false;
        startListening();
        return;
    }
    stopListening();
    appSection.hidden = true;
    gate.hidden = false;
    if (user) {
        gateText.textContent = 'Den konto har ikke adgang.';
        await signOut(auth);
    } else {
        gateText.textContent = 'Log ind for at se noter og karakterer.';
    }
});
