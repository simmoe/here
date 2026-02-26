import { getAuth, signInWithPopup, signOut, GoogleAuthProvider, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

/**
 * Generic Inline Editing System
 * Makes all elements with data-firestore-* attributes editable when logged in
 * Auto-saves changes to Firestore with debouncing
 */

const AUTOSAVE_DELAY = 2000; // 2 seconds after last edit
const AUTHORIZED_EMAIL = 'simmoe@gmail.com'; // Your email

let auth;
let db;
let currentUser = null;
let pendingChanges = new Map(); // Map of element -> {collection, docId, field, value, timeoutId}
let saveIndicator = null;

/**
 * Initialize the editable system
 */
export function initEditable() {
    auth = window.firebaseAuth;
    db = window.firebaseDb;
    
    if (!auth || !db) {
        console.error('Firebase not initialized! Make sure firebaseAuth and firebaseDb are available.');
        return;
    }
    
    createSaveIndicator();
    createAuthUI();
    
    // Listen for auth state changes
    onAuthStateChanged(auth, (user) => {
        if (user && user.email === AUTHORIZED_EMAIL) {
            currentUser = user;
            console.log('Logged in as:', user.email);
            enableEditing();
            updateAuthUI(true);
        } else {
            currentUser = null;
            console.log('Not logged in or unauthorized');
            disableEditing();
            updateAuthUI(false);
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
 * Create auth UI (login/logout button)
 */
function createAuthUI() {
    const authButton = document.createElement('button');
    authButton.id = 'auth-button';
    authButton.style.cssText = `
        position: fixed;
        bottom: 1rem;
        right: 1rem;
        padding: 0.75rem 1.5rem;
        background: #333;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        z-index: 9999;
        transition: background 0.2s;
    `;
    authButton.textContent = 'Login';
    authButton.addEventListener('click', handleAuthClick);
    authButton.addEventListener('mouseenter', () => {
        authButton.style.background = '#555';
    });
    authButton.addEventListener('mouseleave', () => {
        authButton.style.background = '#333';
    });
    document.body.appendChild(authButton);
}

/**
 * Update auth UI based on login state
 */
function updateAuthUI(isLoggedIn) {
    const authButton = document.getElementById('auth-button');
    if (authButton) {
        authButton.textContent = isLoggedIn ? 'Logout' : 'Login';
        authButton.style.background = isLoggedIn ? '#4CAF50' : '#333';
    }
}

/**
 * Handle auth button click
 */
async function handleAuthClick() {
    if (currentUser) {
        // Logout
        try {
            await signOut(auth);
            console.log('Logged out');
        } catch (error) {
            console.error('Logout error:', error);
        }
    } else {
        // Login
        const provider = new GoogleAuthProvider();
        try {
            console.log('Attempting login...');
            console.log('Current domain:', window.location.hostname);
            console.log('Auth domain config:', auth.config.authDomain);
            
            const result = await signInWithPopup(auth, provider);
            if (result.user.email !== AUTHORIZED_EMAIL) {
                await signOut(auth);
                alert('Unauthorized email. Only ' + AUTHORIZED_EMAIL + ' can edit.');
            }
        } catch (error) {
            console.error('Login error FULL:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            alert('Login failed: ' + error.message + '\n\nSee console for details.');
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
