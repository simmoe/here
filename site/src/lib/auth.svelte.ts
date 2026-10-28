import {
	browserLocalPersistence,
	getRedirectResult,
	GoogleAuthProvider,
	onAuthStateChanged,
	setPersistence,
	signInWithPopup,
	signInWithRedirect,
	signOut,
	type User
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase/client';
import { OWNER_EMAIL } from './firebase/config';

const AFTER = 'here-after-login';
const INFLIGHT = 'here-login-inflight';

class AuthState {
	user = $state<User | null>(null);
	ready = $state(false);
	error = $state('');
	#started = false;
	#loggingIn = false;

	get isOwner() {
		return this.user?.email === OWNER_EMAIL;
	}

	init() {
		if (this.#started) return;
		this.#started = true;
		void this.#boot();
	}

	async #boot() {
		const auth = getFirebaseAuth();
		const pending = sessionStorage.getItem(INFLIGHT) === '1';
		try {
			await setPersistence(auth, browserLocalPersistence);
			await getRedirectResult(auth);
		} catch (error) {
			console.error(error);
			this.error = codeOf(error);
			sessionStorage.removeItem(AFTER);
		}
		sessionStorage.removeItem(INFLIGHT);
		if (pending && !auth.currentUser && !this.error) {
			this.error = 'Login blev ikke gennemført.';
			sessionStorage.removeItem(AFTER);
		}
		onAuthStateChanged(auth, (user) => {
			if (user && user.email !== OWNER_EMAIL) {
				void signOut(auth);
				this.user = null;
				this.error = 'Den konto har ikke adgang. Brug ' + OWNER_EMAIL + '.';
				this.ready = true;
				sessionStorage.removeItem(AFTER);
				return;
			}
			this.user = user;
			this.ready = true;
			if (user) this.error = '';
			const dest = sessionStorage.getItem(AFTER);
			if (user && dest && location.pathname !== dest) {
				sessionStorage.removeItem(AFTER);
				location.assign(dest);
			}
		});
	}

	async login() {
		if (this.#loggingIn) return;
		this.#loggingIn = true;
		this.error = '';
		sessionStorage.removeItem('here-logged-out');
		sessionStorage.setItem(AFTER, '/work');
		const provider = new GoogleAuthProvider();
		provider.setCustomParameters({ prompt: 'select_account' });
		const auth = getFirebaseAuth();
		try {
			await signInWithPopup(auth, provider);
		} catch (error) {
			const code = codeOf(error);
			console.error(error);
			if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
				sessionStorage.setItem(INFLIGHT, '1');
				await signInWithRedirect(auth, provider);
				return;
			}
			if (code === 'auth/popup-closed-by-user') {
				sessionStorage.removeItem(AFTER);
				this.error = 'Login blev lukket.';
			} else {
				sessionStorage.removeItem(AFTER);
				this.error = code || 'Login fejlede.';
			}
		} finally {
			this.#loggingIn = false;
		}
	}

	async logout() {
		sessionStorage.setItem('here-logged-out', '1');
		sessionStorage.removeItem(AFTER);
		await signOut(getFirebaseAuth());
	}
}

function codeOf(error: unknown) {
	if (error && typeof error === 'object' && 'code' in error) return String(error.code);
	if (error instanceof Error) return error.message;
	return 'Login fejlede.';
}

export const authState = new AuthState();
