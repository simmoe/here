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
const groupView = document.querySelector('#group-view');
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
    groups: [],
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
    groupView.replaceChildren();
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

    renderGroups(current);
}

function renderGroups(current) {
    const heading = document.createElement('h2');
    heading.textContent = 'Projektgrupper';
    groupView.appendChild(heading);

    const groups = state.groups
        .filter((item) => item.classId === current.id)
        .sort((a, b) => (a.projectName || '').localeCompare(b.projectName || '', 'da'));

    groups.forEach((group) => {
        const card = document.createElement('article');
        card.className = 'group';

        const title = document.createElement('h3');
        title.textContent = group.projectName;
        card.appendChild(title);

        const members = document.createElement('p');
        members.className = 'meta';
        members.textContent = (group.studentIds || [])
            .map((id) => state.students.get(id)?.name || 'Ukendt elev')
            .sort((a, b) => a.localeCompare(b, 'da'))
            .join(', ');
        card.appendChild(members);

        (group.fields || []).forEach((field) => {
            const label = document.createElement('label');
            const caption = document.createElement('span');
            caption.textContent = field.label;
            const input = document.createElement('textarea');
            input.rows = 3;
            input.value = group.values?.[field.key] || '';
            input.addEventListener('input', () => scheduleGroupSave(group.id, field.key, input.value));
            label.append(caption, input);
            card.appendChild(label);
        });

        const addField = document.createElement('form');
        const fieldLabel = document.createElement('input');
        fieldLabel.placeholder = 'Nyt felt';
        fieldLabel.required = true;
        const addButton = document.createElement('button');
        addButton.type = 'submit';
        addButton.className = 'secondary';
        addButton.textContent = 'Tilføj felt';
        addField.append(fieldLabel, addButton);
        addField.addEventListener('submit', async (event) => {
            event.preventDefault();
            const labelText = fieldLabel.value.trim();
            if (!labelText) return;
            const key = uniqueFieldKey(labelText, group.fields || []);
            await updateDoc(doc(db, 'here_private_groups', group.id), {
                fields: [...(group.fields || []), { key, label: labelText, kind: 'longtext' }],
                updatedAt: serverTimestamp()
            });
        });

        card.append(
            addField,
            button('Slet gruppe', 'secondary', () => deleteDoc(doc(db, 'here_private_groups', group.id)))
        );
        groupView.appendChild(card);
    });

    const form = document.createElement('form');
    const nameLabel = document.createElement('label');
    const nameCaption = document.createElement('span');
    nameCaption.textContent = 'Projektnavn';
    const nameInput = document.createElement('input');
    nameInput.required = true;
    nameLabel.append(nameCaption, nameInput);

    const checks = document.createElement('div');
    checks.className = 'checks';
    const enrolled = state.enrollments
        .filter((item) => item.classId === current.id)
        .map((item) => state.students.get(item.studentId))
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name, 'da'));
    enrolled.forEach((student) => {
        const label = document.createElement('label');
        label.className = 'check';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.value = student.id;
        label.append(box, document.createTextNode(student.name));
        checks.appendChild(label);
    });

    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = 'Opret gruppe';
    form.append(nameLabel, checks, save);
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const studentIds = [...checks.querySelectorAll('input:checked')].map((input) => input.value);
        if (studentIds.length < 2) {
            statusEl.textContent = 'En gruppe skal have mindst to elever.';
            return;
        }
        try {
            await addDoc(collection(db, 'here_private_groups'), {
                classId: current.id,
                projectName: nameInput.value.trim(),
                studentIds,
                fields: [],
                values: {},
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            form.reset();
            statusEl.textContent = 'Gruppe gemt';
        } catch (error) {
            console.error(error);
            statusEl.textContent = 'Kunne ikke gemme gruppen.';
        }
    });
    groupView.appendChild(form);
}

function uniqueFieldKey(label, fields) {
    const base = label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'felt';
    const taken = new Set(fields.map((field) => field.key));
    let key = base;
    let n = 2;
    while (taken.has(key)) {
        key = base + '-' + n;
        n += 1;
    }
    return key;
}

function scheduleGroupSave(groupId, key, value) {
    const timerKey = 'group:' + groupId + ':' + key;
    clearTimeout(saveTimers.get(timerKey));
    statusEl.textContent = 'Gemmer…';
    saveTimers.set(timerKey, setTimeout(async () => {
        try {
            await updateDoc(doc(db, 'here_private_groups', groupId), {
                [`values.${key}`]: value,
                updatedAt: serverTimestamp()
            });
            statusEl.textContent = 'Gemt';
        } catch (error) {
            console.error(error);
            statusEl.textContent = 'Kunne ikke gemme.';
        }
    }, 500));
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
    watch('here_private_groups', (snap) => {
        state.groups = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
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
    state.groups = [];
    classNav.replaceChildren();
    classView.replaceChildren();
    groupView.replaceChildren();
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
