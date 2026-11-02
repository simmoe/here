/** Offentlig Firebase-webkonfiguration. Samme projekt som de andre sites. Adgang styres af rules. */
export const firebaseConfig = {
	apiKey: 'AIzaSyDU1QQ5IOx65YauKjemsexCpfgNBblrQRc',
	// Same-origin auth so redirect login keeps the session on this Hosting site.
	authDomain: 'here-2026.web.app',
	projectId: 'p5-firebase-eebc1',
	storageBucket: 'p5-firebase-eebc1.appspot.com',
	messagingSenderId: '757530790495',
	appId: '1:757530790495:web:3b63a4a12d2afdad97e9ea'
} as const;

export const OWNER_EMAIL = 'simmoe@gmail.com';
