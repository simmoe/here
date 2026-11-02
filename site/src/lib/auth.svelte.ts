import {
	GoogleAuthProvider,
	onAuthStateChanged,
	signInWithPopup,
	signOut,
	type User
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase/client';
import { OWNER_EMAIL } from './firebase/config';

class AuthState {
	user = $state<User | null>(null);
	ready = $state(false);
	error = $state('');
	busy = $state(false);
	#started = false;

	get isOwner() {
		return !!this.user?.emailVerified && this.user.email === OWNER_EMAIL;
	}

	init() {
		if (this.#started) return;
		this.#started = true;
		onAuthStateChanged(getFirebaseAuth(), (user) => {
			if (user && user.email !== OWNER_EMAIL) {
				void signOut(getFirebaseAuth());
				this.user = null;
				this.error = 'Den konto har ikke adgang. Brug ' + OWNER_EMAIL + '.';
				this.ready = true;
				this.busy = false;
				return;
			}
			this.user = user;
			this.ready = true;
			this.busy = false;
			if (user) this.error = '';
		});
	}

	async login() {
		if (this.busy || this.isOwner) return;
		this.busy = true;
		this.error = '';
		const provider = new GoogleAuthProvider();
		provider.setCustomParameters({ prompt: 'select_account' });
		try {
			await signInWithPopup(getFirebaseAuth(), provider);
		} catch (error) {
			console.error(error);
			this.error = codeOf(error);
		} finally {
			this.busy = false;
		}
	}

	async logout() {
		this.error = '';
		await signOut(getFirebaseAuth());
	}
}

function codeOf(error: unknown) {
	if (error && typeof error === 'object' && 'code' in error) {
		const code = String(error.code);
		if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
			return '';
		}
		return code;
	}
	if (error instanceof Error) return error.message;
	return 'Login fejlede.';
}

export const authState = new AuthState();
