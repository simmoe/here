import {
    getAuth,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signOut,
    GoogleAuthProvider,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

/**
 * Generic Inline Editing System
 * Makes all elements with data-firestore-* attributes editable when logged in
 * Auto-saves changes to Firestore with debouncing
 */

const AUTOSAVE_DELAY = 2000; // 2 seconds after last edit
const AUTHORIZED_EMAIL = 'simmoe@gmail.com'; // Your email
const AUTH_DEBUG = true;
const AUTH_DEBUG_MAX_ENTRIES = 200;

let auth;
let db;
let currentUser = null;
let pendingChanges = new Map(); // Map of element -> {collection, docId, field, value, timeoutId}
let saveIndicator = null;

function sanitizeAuthError(error) {
    if (!error) return null;
    return {
        code: error.code || null,
        message: error.message || null,
        customData: error.customData || null,
        name: error.name || null,
        stack: error.stack || null
    };
}

function testStorage(type) {
    try {
        const storage = type === 'localStorage' ? window.localStorage : window.sessionStorage;
        const key = '__auth_debug_test__';
        storage.setItem(key, '1');
        storage.removeItem(key);
        return { available: true, error: null };
    } catch (error) {
        return {
            available: false,
            error: sanitizeAuthError(error)
        };
    }
}

function getAuthEnvironmentSnapshot() {
    const localStorageStatus = testStorage('localStorage');
    const sessionStorageStatus = testStorage('sessionStorage');

    return {
        timestamp: new Date().toISOString(),
        location: {
            href: window.location.href,
            origin: window.location.origin,
            host: window.location.host,
            hostname: window.location.hostname,
            protocol: window.location.protocol,
            pathname: window.location.pathname
        },
        document: {
            referrer: document.referrer,
            visibilityState: document.visibilityState,
            hasFocus: document.hasFocus()
        },
        browser: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine
        },
        runtime: {
            isIframe: window.self !== window.top,
            crossOriginIsolated: window.crossOriginIsolated || false
        },
        storage: {
            localStorage: localStorageStatus,
            sessionStorage: sessionStorageStatus
        },
        firebase: {
            projectId: auth?.app?.options?.projectId || null,
            authDomain: auth?.app?.options?.authDomain || null,
            apiKeySuffix: auth?.app?.options?.apiKey ? auth.app.options.apiKey.slice(-6) : null
        }
    };
}

function pushAuthDebugEvent(event, details = null, error = null) {
    if (!AUTH_DEBUG) return;

    if (!window.__authDebugHistory) {
        window.__authDebugHistory = [];
    }

    const entry = {
        timestamp: new Date().toISOString(),
        event,
        details,
        error: sanitizeAuthError(error)
    };

    window.__authDebugHistory.push(entry);
    if (window.__authDebugHistory.length > AUTH_DEBUG_MAX_ENTRIES) {
        window.__authDebugHistory.shift();
    }

    if (entry.error) {
        console.error('[AUTH DEBUG]', event, entry);
    } else {
        console.log('[AUTH DEBUG]', event, entry);
    }
}

function exposeAuthDebugHelpers() {
    window.getAuthDebugSnapshot = () => getAuthEnvironmentSnapshot();
    window.getAuthDebugHistory = () => (window.__authDebugHistory || []).slice();
    window.printAuthDebug = () => {
        const snapshot = getAuthEnvironmentSnapshot();
        const history = window.getAuthDebugHistory();
        console.group('Auth debug snapshot');
        console.log('Environment:', snapshot);
        console.log('History count:', history.length);
        console.table(history.map((item) => ({
            timestamp: item.timestamp,
            event: item.event,
            code: item.error?.code || '',
            message: item.error?.message || ''
        })));
        console.groupEnd();
        return { snapshot, history };
    };
}

function setupGlobalAuthDebugHooks() {
    if (window.__authDebugHooksInstalled) return;

    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        const reasonText = reason?.message || String(reason || '');
        if (reasonText.toLowerCase().includes('auth/')) {
            pushAuthDebugEvent('unhandledrejection-auth', {
                reasonText
            }, reason);
        }
    });

    window.addEventListener('storage', (event) => {
        if (event.key && event.key.includes('firebase')) {
            pushAuthDebugEvent('storage-event-firebase', {
                key: event.key,
                oldValueLength: event.oldValue ? event.oldValue.length : 0,
                newValueLength: event.newValue ? event.newValue.length : 0
            });
        }
    });

    window.__authDebugHooksInstalled = true;
}

/**
 * Initialize the editable system
 */
export function initEditable() {
    auth = window.firebaseAuth;
    db = window.firebaseDb;

    exposeAuthDebugHelpers();
    setupGlobalAuthDebugHooks();
    pushAuthDebugEvent('init-start', getAuthEnvironmentSnapshot());
    
    if (!auth || !db) {
        console.error('Firebase not initialized! Make sure firebaseAuth and firebaseDb are available.');
        pushAuthDebugEvent('init-failed-firebase-missing', {
            hasAuth: !!auth,
            hasDb: !!db
        });
        return;
    }
    
    createSaveIndicator();

    setPersistence(auth, browserLocalPersistence)
        .then(() => {
            pushAuthDebugEvent('set-persistence-success', {
                persistence: 'browserLocalPersistence'
            });
        })
        .catch((error) => {
            console.warn('Could not set auth persistence:', error);
            pushAuthDebugEvent('set-persistence-error', null, error);
        });

    getRedirectResult(auth)
        .then((result) => {
            if (result && result.user) {
                pushAuthDebugEvent('redirect-result-user', {
                    email: result.user.email,
                    uid: result.user.uid
                });
            } else {
                pushAuthDebugEvent('redirect-result-empty');
            }
        })
        .catch((error) => {
            if (error && error.code === 'auth/missing-initial-state') {
                console.warn('Redirect result unavailable (missing initial state). This usually means sessionStorage was cleared or unavailable.');
                pushAuthDebugEvent('redirect-result-missing-initial-state', getAuthEnvironmentSnapshot(), error);
                return;
            }
            if (error) {
                console.warn('Redirect result error:', error);
                pushAuthDebugEvent('redirect-result-error', getAuthEnvironmentSnapshot(), error);
            }
        });
    
    // Listen for auth state changes
    onAuthStateChanged(auth, (user) => {
        pushAuthDebugEvent('auth-state-changed', {
            isLoggedIn: !!user,
            email: user?.email || null,
            uid: user?.uid || null,
            isAuthorizedEmail: user?.email === AUTHORIZED_EMAIL
        });

        if (user && user.email === AUTHORIZED_EMAIL) {
            currentUser = user;
            console.log('Logged in as:', user.email);
            enableEditing();
        } else {
            currentUser = null;
            console.log('Not logged in or unauthorized');
            disableEditing();
        }
    });
}

/**
 * Create save indicator (top-right corner)
 */
function createSaveIndicator() {
    saveIndicator = document.createElement('div');
    saveIndicator.id = 'save-indicator';
    saveIndicator.style.cssText = `
        position: fixed;
        top: 1rem;
        right: 1rem;
        padding: 0.5rem 1rem;
        background: #4CAF50;
        color: white;
        border-radius: 4px;
        font-size: 0.9rem;
        opacity: 0;
        transition: opacity 0.3s;
        z-index: 9999;
        pointer-events: none;
    `;
    document.body.appendChild(saveIndicator);
}

/**
 * Handle login/logout
 */
export async function handleAuth() {
    pushAuthDebugEvent('handle-auth-invoked', getAuthEnvironmentSnapshot());

    if (currentUser) {
        // Logout
        try {
            await signOut(auth);
            console.log('Logged out');
            pushAuthDebugEvent('logout-success');
        } catch (error) {
            console.error('Logout error:', error);
            pushAuthDebugEvent('logout-error', null, error);
        }
    } else {
        // Login
        if (window.self !== window.top) {
            pushAuthDebugEvent('login-blocked-iframe', getAuthEnvironmentSnapshot());
            alert('Login must run in a normal browser tab (not inside an embedded preview/iframe). Open simmoe.github.io directly and try again.');
            return;
        }

        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        try {
            console.log('Attempting login...');
            pushAuthDebugEvent('popup-login-attempt', getAuthEnvironmentSnapshot());
            const result = await signInWithPopup(auth, provider);
            pushAuthDebugEvent('popup-login-success', {
                email: result?.user?.email || null,
                uid: result?.user?.uid || null
            });

            if (result.user.email !== AUTHORIZED_EMAIL) {
                await signOut(auth);
                pushAuthDebugEvent('popup-login-unauthorized-email', {
                    email: result.user.email,
                    authorizedEmail: AUTHORIZED_EMAIL
                });
                alert('Unauthorized email. Only ' + AUTHORIZED_EMAIL + ' can edit.');
            }
        } catch (error) {
            console.error('Login error:', error);
            pushAuthDebugEvent('popup-login-error', getAuthEnvironmentSnapshot(), error);

            if (error && error.code === 'auth/unauthorized-domain') {
                const host = window.location.host;
                const projectId = auth?.app?.options?.projectId || 'unknown-project';
                alert(
                    'Login failed: unauthorized domain.\n\n' +
                    'Current host: ' + host + '\n' +
                    'Firebase project: ' + projectId + '\n\n' +
                    'Add this exact host to Firebase Console -> Authentication -> Settings -> Authorized domains, then hard refresh and try again.'
                );
            } else if (error && error.code === 'auth/missing-initial-state') {
                alert(
                    'Login failed: missing initial auth state.\n\n' +
                    'Your browser blocked or cleared session storage during OAuth.\n' +
                    'Open the site directly in a normal tab, disable strict tracking protection for this site, and try again.'
                );
            } else if (error && error.code === 'auth/popup-blocked') {
                try {
                    pushAuthDebugEvent('redirect-login-attempt-after-popup-blocked', getAuthEnvironmentSnapshot());
                    await signInWithRedirect(auth, provider);
                } catch (redirectError) {
                    console.error('Redirect login error:', redirectError);
                    pushAuthDebugEvent('redirect-login-error', getAuthEnvironmentSnapshot(), redirectError);
                    alert('Login failed after popup was blocked: ' + redirectError.message);
                }
            } else {
                alert('Login failed: ' + error.message);
            }
        }
    }
}

/**
 * Enable editing on all elements with data-firestore-* attributes
 * Can be called multiple times safely - only enables elements not already enabled
 */
export function enableEditing() {
    // Only enable if user is logged in
    if (!currentUser || currentUser.email !== AUTHORIZED_EMAIL) {
        return;
    }
    
    const editableElements = document.querySelectorAll('[data-firestore-collection]:not([data-editable-enabled])');
    
    editableElements.forEach(element => {
        element.contentEditable = 'true';
        element.style.cursor = 'text';
        
        // Mark as enabled to prevent duplicate event listeners
        element.dataset.editableEnabled = 'true';
        
        // Add input listener for auto-save
        element.addEventListener('input', handleInput);
        
        // Visual feedback only on hover and focus
        element.addEventListener('mouseenter', () => {
            if (document.activeElement !== element) {
                element.style.outline = '1px dashed rgba(76, 175, 80, 0.3)';
            }
        });
        element.addEventListener('mouseleave', () => {
            if (document.activeElement !== element) {
                element.style.outline = 'none';
            }
        });
        element.addEventListener('focus', () => {
            element.style.outline = '2px solid rgba(76, 175, 80, 0.6)';
        });
        element.addEventListener('blur', () => {
            element.style.outline = 'none';
        });
    });
    
    if (editableElements.length > 0) {
        console.log('Editing enabled on', editableElements.length, 'new elements');
    }
}

/**
 * Disable editing
 */
function disableEditing() {
    const editableElements = document.querySelectorAll('[data-firestore-collection]');
    
    editableElements.forEach(element => {
        element.contentEditable = 'false';
        element.style.outline = 'none';
        element.style.cursor = 'default';
        element.removeEventListener('input', handleInput);
        
        // Remove the enabled flag so it can be re-enabled
        delete element.dataset.editableEnabled;
    });
    
    // Clear pending changes
    pendingChanges.forEach((change, element) => {
        if (change.timeoutId) {
            clearTimeout(change.timeoutId);
        }
    });
    pendingChanges.clear();
}

/**
 * Convert markdown-style lists to HTML lists in real-time
 */
function convertMarkdownToList(element) {
    const children = Array.from(element.children);
    if (children.length === 0) return;
    
    let i = 0;
    let modified = false;
    
    while (i < children.length) {
        const child = children[i];
        const text = (child.textContent || '').trim();
        
        // Check if this paragraph starts with "- "
        if (child.tagName === 'P' && text.startsWith('- ')) {
            // Collect consecutive list items
            const listItems = [];
            let j = i;
            
            while (j < children.length) {
                const currentChild = children[j];
                const currentText = (currentChild.textContent || '').trim();
                
                if (currentChild.tagName === 'P' && currentText.startsWith('- ')) {
                    // Remove "- " prefix
                    const itemText = currentText.substring(2);
                    listItems.push({ element: currentChild, text: itemText });
                    j++;
                } else {
                    break;
                }
            }
            
            // Convert to list if we have items
            if (listItems.length > 0) {
                modified = true;
                
                // Create ul element
                const ul = document.createElement('ul');
                
                // Add list items
                listItems.forEach(item => {
                    const li = document.createElement('li');
                    li.innerHTML = item.text;
                    ul.appendChild(li);
                });
                
                // Replace first paragraph with the list
                listItems[0].element.replaceWith(ul);
                
                // Remove other paragraphs that were converted
                for (let k = 1; k < listItems.length; k++) {
                    listItems[k].element.remove();
                }
            }
            
            i = j;
        } else {
            i++;
        }
    }
    
    return modified;
}

/**
 * Handle input event on editable elements
 */
function handleInput(event) {
    const element = event.target;
    const collection = element.dataset.firestoreCollection;
    const docId = element.dataset.firestoreDoc;
    const field = element.dataset.firestoreField;
    
    if (!collection || !docId || !field) {
        console.warn('Missing data attributes on element:', element);
        return;
    }
    
    // Convert markdown-style lists to HTML lists in real-time
    const isArray = element.dataset.isArray === 'true';
    if (isArray) {
        convertMarkdownToList(element);
    }
    
    // Get the current value
    let value;
    
    if (isArray) {
        // For content arrays, we'll process the DOM children when saving
        // Just store the innerHTML for now
        value = element.innerHTML;
    } else {
        value = element.innerHTML;
        if (!value || value.trim() === '') {
            value = element.textContent || '';
        }
    }
    
    // Ensure we never send undefined
    if (value === undefined || value === null) {
        value = '';
    }
    
    // Clear existing timeout for this element
    const existing = pendingChanges.get(element);
    if (existing && existing.timeoutId) {
        clearTimeout(existing.timeoutId);
    }
    
    // Set new timeout for auto-save
    const timeoutId = setTimeout(() => {
        saveToFirestore(element, collection, docId, field, value);
    }, AUTOSAVE_DELAY);
    
    // Store pending change
    pendingChanges.set(element, {
        collection,
        docId,
        field,
        value,
        timeoutId
    });
    
    showSaveIndicator('Editing...', '#FFA726');
}

/**
 * Save to Firestore
 */
async function saveToFirestore(element, collection, docId, field, value) {
    try {
        // Validate value is not undefined
        if (value === undefined || value === null) {
            console.warn('Skipping save - value is null/undefined for field:', field);
            return;
        }
        
        showSaveIndicator('Saving...', '#FFA726');
        
        const docRef = doc(db, collection, docId);
        
        // Check if this field should be saved as an array (split by paragraphs)
        const isArray = element.dataset.isArray === 'true';
        
        if (isArray) {
            // For content arrays, extract all child elements (p, div, etc.)
            // We re-query the element to get fresh DOM state
            const liveElement = document.querySelector(`[data-firestore-doc="${docId}"][data-firestore-field="${field}"]`);
            
            if (!liveElement) {
                console.error('Could not find element for array save');
                return;
            }
            
            const paragraphs = [];
            
            // Get all children (p, div, ul, etc.) and extract their content
            const children = Array.from(liveElement.children);
            
            if (children.length > 0) {
                // Process children and group consecutive list items
                let i = 0;
                while (i < children.length) {
                    const child = children[i];
                    const content = child.innerHTML.trim();
                    const textContent = (child.textContent || '').trim();
                    
                    // Skip empty paragraphs
                    if (content.length === 0 || content === '<br>' || content === '<br/>') {
                        i++;
                        continue;
                    }
                    
                    // Check if this is a list item (starts with "- ")
                    if (textContent.startsWith('- ')) {
                        // Collect all consecutive list items
                        const listItems = [];
                        while (i < children.length) {
                            const currentChild = children[i];
                            const currentText = (currentChild.textContent || '').trim();
                            
                            if (currentText.startsWith('- ')) {
                                // Remove "- " prefix and add to list
                                listItems.push(currentText.substring(2));
                                i++;
                            } else {
                                break;
                            }
                        }
                        
                        // Create list HTML (without bullets in text)
                        if (listItems.length > 0) {
                            const listHTML = '<ul>\n' + 
                                listItems.map(item => `<li>${item}</li>`).join('\n') + 
                                '\n</ul>';
                            paragraphs.push(listHTML);
                        }
                    } else {
                        // Regular paragraph or already HTML
                        paragraphs.push(content);
                        i++;
                    }
                }
            } else {
                // No child elements - might be plain text or <br> separated
                const html = liveElement.innerHTML;
                const parts = html
                    .split(/<br\s*\/?>\s*<br\s*\/?>|\n\n/)
                    .map(p => p.trim())
                    .filter(p => p.length > 0 && p !== '<br>' && p !== '<br/>');
                
                paragraphs.push(...parts);
            }
            
            // If still no paragraphs, use the whole content as one paragraph
            if (paragraphs.length === 0) {
                const content = liveElement.textContent?.trim();
                if (content && content.length > 0) {
                    paragraphs.push(content);
                }
            }
            
            await updateDoc(docRef, {
                [field]: paragraphs
            });
            
            console.log('Saved array:', collection, docId, field, '=', paragraphs.length, 'paragraphs', paragraphs);
        } else {
            // Check if this is an array field with index (e.g., "content.0") - legacy
            if (field.includes('.') && !isNaN(parseInt(field.split('.').pop()))) {
                // This is an array index field like "content.0"
                // We need to update the whole array to keep it as an array in Firestore
                const [arrayName, indexStr] = field.split('.');
                const index = parseInt(indexStr);
                
                // Get current document to read the full array
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const currentData = docSnap.data();
                    let arrayData = currentData[arrayName];
                    
                    // Convert object to array if needed
                    if (arrayData && typeof arrayData === 'object' && !Array.isArray(arrayData)) {
                        const arr = [];
                        Object.keys(arrayData).sort((a, b) => parseInt(a) - parseInt(b)).forEach(key => {
                            arr.push(arrayData[key]);
                        });
                        arrayData = arr;
                    }
                    
                    // Ensure it's an array
                    if (!Array.isArray(arrayData)) {
                        arrayData = [];
                    }
                    
                    // Update the specific index
                    arrayData[index] = value;
                    
                    // Save the whole array
                    await updateDoc(docRef, {
                        [arrayName]: arrayData
                    });
                    
                    console.log('Saved array:', collection, docId, arrayName, '[', index, '] =', value);
                }
            } else {
                // Regular field or nested object field (e.g., "recipient.company")
                const updateData = {
                    [field]: value
                };
                
                console.log('Updating Firestore:', collection, docId, field, '=', value);
                await updateDoc(docRef, updateData);
                console.log('Saved:', collection, docId, field);
            }
        }
        
        showSaveIndicator('Saved ✓', '#4CAF50');
        
        // Remove from pending changes
        pendingChanges.delete(element);
        
    } catch (error) {
        console.error('Save error:', error);
        console.error('Failed to save:', collection, docId, field, '=', value);
        showSaveIndicator('Error!', '#F44336');
        alert('Failed to save changes: ' + error.message);
    }
}

/**
 * Set nested value in object using dot notation
 * Handles both nested objects (a.b.c) and arrays (content.0)
 */
function setNestedValue(obj, path, value) {
    // Ensure value is never undefined
    if (value === undefined) {
        console.warn('setNestedValue received undefined value for path:', path);
        value = '';
    }
    
    const parts = path.split('.');
    const lastPart = parts[parts.length - 1];
    
    if (parts.length === 1) {
        obj[path] = value;
        return obj;
    }
    
    // Build nested structure
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!(part in current)) {
            // Check if next part is a number (array index)
            const nextPart = parts[i + 1];
            const nextIsNumber = !isNaN(parseInt(nextPart));
            
            if (nextIsNumber) {
                // For arrays, create an object instead to avoid sparse arrays in Firestore
                // Firestore will convert it properly
                current[part] = {};
            } else {
                current[part] = {};
            }
        }
        current = current[part];
    }
    
    current[lastPart] = value;
    return obj;
}

/**
 * Show save indicator with message and color
 */
function showSaveIndicator(message, color) {
    if (saveIndicator) {
        saveIndicator.textContent = message;
        saveIndicator.style.background = color;
        saveIndicator.style.opacity = '1';
        
        // Auto-hide after 2 seconds if saved successfully
        if (message.includes('✓')) {
            setTimeout(() => {
                saveIndicator.style.opacity = '0';
            }, 2000);
        }
    }
}

// Make functions available globally
window.initEditable = initEditable;
window.enableEditing = enableEditing;
window.handleAuth = handleAuth;
