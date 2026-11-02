import {
	getRedirectResult,
	GoogleAuthProvider,
	onAuthStateChanged,
	signInWithPopup,
	signInWithRedirect,
	signOut,
	type User
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase/client';
import { OWNER_EMAIL } from './firebase/config';

const AFTER = 'here-after-login';

class AuthState {
	user = $state<User | null>(null);
	ready = $state(false);
	error = $state('');
	busy = $state(false);
	#started = false;

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
		try {
			const redirected = await getRedirectResult(auth);
			if (redirected?.user) this.error = '';
		} catch (error) {
			console.error(error);
			this.error = codeOf(error);
			sessionStorage.removeItem(AFTER);
		}

		onAuthStateChanged(auth, (user) => {
			if (user && user.email !== OWNER_EMAIL) {
				void signOut(auth);
				this.user = null;
				this.error = 'Den konto har ikke adgang. Brug ' + OWNER_EMAIL + '.';
				this.ready = true;
				this.busy = false;
				sessionStorage.removeItem(AFTER);
				return;
			}
			this.user = user;
			this.ready = true;
			this.busy = false;
			if (user) this.error = '';
			const dest = sessionStorage.getItem(AFTER);
			if (user && dest) {
				sessionStorage.removeItem(AFTER);
				if (location.pathname !== dest) location.assign(dest);
			}
		});
	}

	async login() {
		if (this.busy || this.isOwner) return;
		this.busy = true;
		this.error = '';
		sessionStorage.removeItem('here-logged-out');
		sessionStorage.setItem(AFTER, '/work');
		const provider = new GoogleAuthProvider();
		provider.setCustomParameters({ prompt: 'select_account' });
		const auth = getFirebaseAuth();
		try {
			await signInWithPopup(auth, provider);
			this.busy = false;
		} catch (error) {
			const code = codeOf(error);
			console.error(error);
			if (
				code === 'auth/popup-blocked' ||
				code === 'auth/cancelled-popup-request' ||
				code === 'auth/popup-closed-by-user'
			) {
				try {
					await signInWithRedirect(auth, provider);
					return;
				} catch (redirectError) {
					console.error(redirectError);
					sessionStorage.removeItem(AFTER);
					this.error = codeOf(redirectError);
					this.busy = false;
					return;
				}
			}
			sessionStorage.removeItem(AFTER);
			this.error = code;
			this.busy = false;
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
