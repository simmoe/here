/**
 * Migration script to upload JSON data to Firestore
 * Run once with: node migrate-to-firestore.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDU1QQ5IOx65YauKjemsexCpfgNBblrQRc",
  authDomain: "p5-firebase-eebc1.firebaseapp.com",
  databaseURL: "https://p5-firebase-eebc1-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "p5-firebase-eebc1",
  storageBucket: "p5-firebase-eebc1.appspot.com",
  messagingSenderId: "757530790495",
  appId: "1:757530790495:web:3b63a4a12d2afdad97e9ea",
  measurementId: "G-JR2VDMFNZ8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Read JSON files
function readJSON(filename) {
  const filePath = path.join(__dirname, filename);
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

async function migrate() {
  console.log('Starting migration to Firestore...\n');

  try {
    // 1. Migrate sitemeta.json to here_content/meta
    console.log('Migrating sitemeta.json...');
    const sitemeta = readJSON('sitemeta.json');
    await setDoc(doc(db, 'here_content', 'meta'), sitemeta);
    console.log('✓ sitemeta.json migrated to here_content/meta\n');

    // 2. Migrate contact.json to here_content/contact
    console.log('Migrating contact.json...');
    const contact = readJSON('contact.json');
    await setDoc(doc(db, 'here_content', 'contact'), contact);
    console.log('✓ contact.json migrated to here_content/contact\n');

    // 3. Migrate cv.json to here_cv collection (one document per entry)
    console.log('Migrating cv.json...');
    const cvData = readJSON('cv.json');
    let cvCount = 0;
    
    // First, save resume texts as a special document
    if (cvData['resume-short'] || cvData.resume) {
      await setDoc(doc(db, 'here_cv', '_resume'), {
        'resume-short': cvData['resume-short'] || '',
        'resume': cvData.resume || ''
      });
      console.log('✓ Saved resume texts to here_cv/_resume');
    }
    
    // Then save all CV entries
    for (const entry of cvData.cv) {
      if (!entry.id) {
        console.log(`⚠ Skipping CV entry without id: ${entry.title || 'unknown'}`);
        continue;
      }
      try {
        await setDoc(doc(db, 'here_cv', entry.id), entry);
        cvCount++;
      } catch (error) {
        console.log(`⚠ Error migrating CV entry ${entry.id}: ${error.message}`);
      }
    }
    console.log(`✓ ${cvCount} CV entries migrated to here_cv collection\n`);

    // 4. Migrate projects.json to here_projects collection
    console.log('Migrating projects.json...');
    const projectsData = readJSON('projects.json');
    let projectCount = 0;
    for (const project of projectsData.projects) {
      if (!project.id) {
        console.log(`⚠ Skipping project without id: ${project.title || 'unknown'}`);
        continue;
      }
      try {
        await setDoc(doc(db, 'here_projects', project.id), project);
        projectCount++;
      } catch (error) {
        console.log(`⚠ Error migrating project ${project.id}: ${error.message}`);
      }
    }
    console.log(`✓ ${projectCount} projects migrated to here_projects collection\n`);

    // 5. Migrate applications.json to here_applications collection
    console.log('Migrating applications.json...');
    const applicationsData = readJSON('applications.json');
    let appCount = 0;
    for (const application of applicationsData.applications) {
      if (!application.id) {
        console.log(`⚠ Skipping application without id: ${application.title || 'unknown'}`);
        continue;
      }
      try {
        await setDoc(doc(db, 'here_applications', application.id), application);
        appCount++;
      } catch (error) {
        console.log(`⚠ Error migrating application ${application.id}: ${error.message}`);
      }
    }
    console.log(`✓ ${appCount} applications migrated to here_applications collection\n`);

    // 6. Migrate recommendations.json to here_recommendations collection
    console.log('Migrating recommendations.json...');
    const recommendationsData = readJSON('recommendations.json');
    let recCount = 0;
    for (const rec of recommendationsData.recommendations) {
      if (!rec.id) {
        console.log(`⚠ Skipping recommendation without id: ${rec.name || 'unknown'}`);
        continue;
      }
      try {
        await setDoc(doc(db, 'here_recommendations', rec.id), rec);
        recCount++;
      } catch (error) {
        console.log(`⚠ Error migrating recommendation ${rec.id}: ${error.message}`);
      }
    }
    console.log(`✓ ${recCount} recommendations migrated to here_recommendations collection\n`);

    console.log('═══════════════════════════════════════');
    console.log('Migration completed successfully! ✓');
    console.log('═══════════════════════════════════════');
    console.log(`Total items migrated:`);
    console.log(`  - Content: 2 documents`);
    console.log(`  - CV entries: ${cvCount}`);
    console.log(`  - Projects: ${projectCount}`);
    console.log(`  - Applications: ${appCount}`);
    console.log(`  - Recommendations: ${recCount}`);
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run migration
migrate();
