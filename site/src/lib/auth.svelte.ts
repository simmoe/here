import {
	browserLocalPersistence,
	getRedirectResult,
	GoogleAuthProvider,
	onAuthStateChanged,
	setPersistence,
	signInWithRedirect,
	signOut,
	type User
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase/client';
import { OWNER_EMAIL } from './firebase/config';

class AuthState {
	user = $state<User | null>(null);
	ready = $state(false);
	error = $state('');
	#started = false;

	get isOwner() {
		return this.user?.email === OWNER_EMAIL;
	}

	init() {
		if (this.#started) return;
		this.#started = true;
		const auth = getFirebaseAuth();
		setPersistence(auth, browserLocalPersistence).catch(console.error);
		getRedirectResult(auth).catch((error: { code?: string; message?: string }) => {
			console.error(error);
			this.error = error?.code || error?.message || 'Login fejlede';
		});
		onAuthStateChanged(auth, (user) => {
			if (user && user.email !== OWNER_EMAIL) {
				void signOut(auth);
				this.user = null;
				this.error = 'Den konto har ikke adgang.';
				this.ready = true;
				return;
			}
			this.user = user;
			this.ready = true;
		});
	}

	async login() {
		this.error = '';
		const provider = new GoogleAuthProvider();
		provider.setCustomParameters({ prompt: 'select_account' });
		await signInWithRedirect(getFirebaseAuth(), provider);
	}

	async logout() {
		await signOut(getFirebaseAuth());
	}
}

export const authState = new AuthState();
