import { collection, getDocs, doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

/**
 * Firestore Data Layer
 * Provides async functions to load and save data to/from Firestore
 */

// Get the db instance from global scope (initialized in HTML)
const getDb = () => window.firebaseDb;

/**
 * Load all data from Firestore
 * Returns data in the same format as the JSON files for compatibility
 */
export async function loadAllData() {
    const db = getDb();
    
    try {
        // Load all data in parallel
        const [sitemeta, contact, cv, projects, applications, recommendations] = await Promise.all([
            loadSiteMeta(db),
            loadContact(db),
            loadCV(db),
            loadProjects(db),
            loadApplications(db),
            loadRecommendations(db)
        ]);
        
        return {
            sitemeta,
            contact,
            cv,
            projects,
            applications,
            recommendations
        };
    } catch (error) {
        console.error('Error loading data from Firestore:', error);
        throw error;
    }
}

/**
 * Load site metadata (navigation, frontpage content)
 */
async function loadSiteMeta(db) {
    const docRef = doc(db, 'here_content', 'meta');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        return docSnap.data();
    } else {
        console.warn('No sitemeta document found');
        return { navigation: {}, frontpage: {} };
    }
}

/**
 * Load contact information
 */
async function loadContact(db) {
    const docRef = doc(db, 'here_content', 'contact');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        return docSnap.data();
    } else {
        console.warn('No contact document found');
        return {};
    }
}

/**
 * Load CV data
 * Returns in same format as cv.json: { "resume-short": "...", "resume": "...", "cv": [...] }
 */
async function loadCV(db) {
    const cvCollection = collection(db, 'here_cv');
    const snapshot = await getDocs(cvCollection);
    
    const cvEntries = [];
    let resumeShort = '';
    let resume = '';
    
    snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        
        // Check if this is the special _resume document
        if (docSnapshot.id === '_resume') {
            resumeShort = data['resume-short'] || '';
            resume = data['resume'] || '';
            return; // Skip adding to CV entries
        }
        
        // Add regular CV entries
        if (data.title && data.place) {
            cvEntries.push(data);
        }
    });
    
    // Sort by order field (ascending)
    cvEntries.sort((a, b) => (a.order || 999) - (b.order || 999));
    
    return {
        'resume-short': resumeShort,
        'resume': resume,
        'cv': cvEntries
    };
}

/**
 * Load projects data
 * Returns in same format as projects.json: { "projects": [...] }
 */
async function loadProjects(db) {
    const projectsCollection = collection(db, 'here_projects');
    const snapshot = await getDocs(projectsCollection);
    
    const projects = [];
    snapshot.forEach((doc) => {
        projects.push(doc.data());
    });
    
    // Sort by year (descending)
    projects.sort((a, b) => (b.year || 0) - (a.year || 0));
    
    return { projects };
}

/**
 * Load applications data
 * Returns in same format as applications.json: { "applications": [...] }
 */
async function loadApplications(db) {
    const applicationsCollection = collection(db, 'here_applications');
    const snapshot = await getDocs(applicationsCollection);
    
    const applications = [];
    snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Convert content object to array if needed
        // (happens when editing with dot notation like "content.0")
        if (data.content && typeof data.content === 'object' && !Array.isArray(data.content)) {
            // It's an object with numeric keys - convert to array
            const contentArray = [];
            Object.keys(data.content)
                .sort((a, b) => parseInt(a) - parseInt(b)) // Sort by index
                .forEach(key => {
                    contentArray.push(data.content[key]);
                });
            data.content = contentArray;
        }
        
        applications.push(data);
    });
    
    // Sort by date (most recent first)
    applications.sort((a, b) => {
        const dateA = new Date(a.date || '1900-01-01');
        const dateB = new Date(b.date || '1900-01-01');
        return dateB - dateA;
    });
    
    return { applications };
}

/**
 * Load recommendations data
 * Returns in same format as recommendations.json: { "recommendations": [...] }
 */
async function loadRecommendations(db) {
    const recommendationsCollection = collection(db, 'here_recommendations');
    const snapshot = await getDocs(recommendationsCollection);
    
    const recommendations = [];
    snapshot.forEach((doc) => {
        recommendations.push(doc.data());
    });
    
    return { recommendations };
}

/**
 * Update an application in Firestore
 * @param {string} applicationId - The ID of the application to update
 * @param {object} data - The updated data
 */
export async function updateApplication(applicationId, data) {
    const db = getDb();
    const docRef = doc(db, 'here_applications', applicationId);
    
    try {
        await setDoc(docRef, data);
        console.log(`Application ${applicationId} updated successfully`);
        return true;
    } catch (error) {
        console.error(`Error updating application ${applicationId}:`, error);
        throw error;
    }
}

/**
 * Update a project in Firestore
 */
export async function updateProject(projectId, data) {
    const db = getDb();
    const docRef = doc(db, 'here_projects', projectId);
    
    try {
        await setDoc(docRef, data);
        console.log(`Project ${projectId} updated successfully`);
        return true;
    } catch (error) {
        console.error(`Error updating project ${projectId}:`, error);
        throw error;
    }
}

/**
 * Update a CV entry in Firestore
 */
export async function updateCVEntry(cvId, data) {
    const db = getDb();
    const docRef = doc(db, 'here_cv', cvId);
    
    try {
        await setDoc(docRef, data);
        console.log(`CV entry ${cvId} updated successfully`);
        return true;
    } catch (error) {
        console.error(`Error updating CV entry ${cvId}:`, error);
        throw error;
    }
}

// Make functions available globally for p5.js script
window.loadAllData = loadAllData;
window.updateApplication = updateApplication;
window.updateProject = updateProject;
window.updateCVEntry = updateCVEntry;
