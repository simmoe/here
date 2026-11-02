import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
	browserLocalPersistence,
	browserPopupRedirectResolver,
	getAuth,
	indexedDBLocalPersistence,
	initializeAuth,
	type Auth
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

export function getFirebaseApp(): FirebaseApp {
	if (app) return app;
	app = getApps()[0] ?? initializeApp(firebaseConfig);
	return app;
}

export function getFirebaseAuth(): Auth {
	if (auth) return auth;
	const firebaseApp = getFirebaseApp();
	try {
		auth = initializeAuth(firebaseApp, {
			persistence: [indexedDBLocalPersistence, browserLocalPersistence],
			popupRedirectResolver: browserPopupRedirectResolver
		});
	} catch {
		auth = getAuth(firebaseApp);
	}
	return auth;
}

export function getDb(): Firestore {
	if (db) return db;
	db = getFirestore(getFirebaseApp());
	return db;
}
