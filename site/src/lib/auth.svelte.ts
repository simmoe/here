import { OWNER_EMAIL } from './firebase/config';
import type { User, UserCredential } from 'firebase/auth';

class AuthState {
	user = $state<User | null>(null);
	ready = $state(false);
	error = $state('');
	busy = $state(false);
	googleToken = $state('');
	#started = false;
	#ready = Promise.withResolvers<void>();

	get isOwner() {
		return this.user?.email === OWNER_EMAIL;
	}

	init() {
		if (this.#started) return;
		this.#started = true;
		void this.#listen();
	}

	async #listen() {
		const [{ onAuthStateChanged, signOut }, { getFirebaseAuth }] = await Promise.all([
			import('firebase/auth'),
			import('./firebase/client')
		]);
		onAuthStateChanged(getFirebaseAuth(), (user) => {
			if (user && user.email !== OWNER_EMAIL) {
				void signOut(getFirebaseAuth());
				this.user = null;
				this.error = 'Den konto har ikke adgang. Brug ' + OWNER_EMAIL + '.';
				this.ready = true;
				this.busy = false;
				this.#ready.resolve();
				return;
			}
			this.user = user;
			this.ready = true;
			this.busy = false;
			if (user) this.error = '';
			this.#ready.resolve();
		});
	}

	async login() {
		if (this.busy) return;
		this.init();
		if (!this.ready) await this.#ready.promise;
		if (this.isOwner) return;
		this.busy = true;
		this.error = '';
		try {
			const [{ GoogleAuthProvider, signInWithPopup }, { getFirebaseAuth }] = await Promise.all([
				import('firebase/auth'),
				import('./firebase/client')
			]);
			await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
		} catch (error) {
			console.error(error);
			this.error = codeOf(error);
		} finally {
			this.busy = false;
		}
	}

	/** Google access token for calendar, Gmail, and Photos Picker. A popup opens only when the user asks. */
	async ensureGoogle(interactive: boolean) {
		const cached = this.googleToken || readGoogleToken();
		if (cached) {
			this.googleToken = cached;
			return cached;
		}
		if (!interactive || this.busy) return '';
		this.busy = true;
		try {
			const [{ GoogleAuthProvider, signInWithPopup }, { getFirebaseAuth }] = await Promise.all([
				import('firebase/auth'),
				import('./firebase/client')
			]);
			const provider = new GoogleAuthProvider();
			for (const scope of googleScopes) provider.addScope(scope);
			provider.setCustomParameters({
				login_hint: OWNER_EMAIL,
				prompt: 'consent',
				include_granted_scopes: 'true'
			});
			const result = await signInWithPopup(getFirebaseAuth(), provider);
			return keepGoogleToken(this, result, GoogleAuthProvider);
		} catch (error) {
			console.error(error);
			return '';
		} finally {
			this.busy = false;
		}
	}

	async logout() {
		this.error = '';
		clearGoogleToken(this);
		const [{ signOut }, { getFirebaseAuth }] = await Promise.all([
			import('firebase/auth'),
			import('./firebase/client')
		]);
		await signOut(getFirebaseAuth());
	}
}

const googleScopes = [
	'https://www.googleapis.com/auth/calendar.readonly',
	'https://www.googleapis.com/auth/gmail.readonly',
	'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'
];
const googleKey = 'here-google-token';

function keepGoogleToken(
	state: AuthState,
	result: UserCredential,
	GoogleAuthProvider: typeof import('firebase/auth').GoogleAuthProvider
) {
	const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken ?? '';
	if (!token) return '';
	state.googleToken = token;
	sessionStorage.setItem(googleKey, JSON.stringify({ token, until: Date.now() + 50 * 60 * 1000 }));
	sessionStorage.removeItem('here-calendar-token');
	return token;
}

function readGoogleToken() {
	try {
		const parsed = JSON.parse(sessionStorage.getItem(googleKey) || '') as { token?: string; until?: number };
		if (!parsed.token || !parsed.until || parsed.until < Date.now()) return '';
		return parsed.token;
	} catch {
		return '';
	}
}

export function clearGoogleToken(state: { googleToken: string } = authState) {
	state.googleToken = '';
	sessionStorage.removeItem(googleKey);
	sessionStorage.removeItem('here-calendar-token');
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
