import {
	GoogleAuthProvider,
	onAuthStateChanged,
	signInWithPopup,
	signOut,
	type User,
	type UserCredential
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase/client';
import { OWNER_EMAIL } from './firebase/config';

class AuthState {
	user = $state<User | null>(null);
	ready = $state(false);
	error = $state('');
	busy = $state(false);
	calendarToken = $state('');
	#started = false;
	#ready = Promise.withResolvers<void>();

	get isOwner() {
		return this.user?.email === OWNER_EMAIL;
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
			await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
		} catch (error) {
			console.error(error);
			this.error = codeOf(error);
		} finally {
			this.busy = false;
		}
	}

	/** Google access token for the private calendar. A popup opens only when the user asks. */
	async ensureCalendar(interactive: boolean) {
		const cached = this.calendarToken || readCalendarToken();
		if (cached) {
			this.calendarToken = cached;
			return cached;
		}
		if (!interactive || this.busy) return '';
		this.busy = true;
		try {
			const result = await signInWithPopup(getFirebaseAuth(), calendarProvider());
			return keepCalendarToken(this, result);
		} catch (error) {
			console.error(error);
			return '';
		} finally {
			this.busy = false;
		}
	}

	async logout() {
		this.error = '';
		clearCalendarToken(this);
		await signOut(getFirebaseAuth());
	}
}

const calendarScope = 'https://www.googleapis.com/auth/calendar.readonly';
const calendarKey = 'here-calendar-token';

function calendarProvider() {
	const provider = new GoogleAuthProvider();
	provider.addScope(calendarScope);
	provider.setCustomParameters({
		login_hint: OWNER_EMAIL,
		prompt: 'consent',
		include_granted_scopes: 'true'
	});
	return provider;
}

function keepCalendarToken(state: AuthState, result: UserCredential) {
	const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken ?? '';
	if (!token) return '';
	state.calendarToken = token;
	sessionStorage.setItem(calendarKey, JSON.stringify({ token, until: Date.now() + 50 * 60 * 1000 }));
	return token;
}

function readCalendarToken() {
	try {
		const parsed = JSON.parse(sessionStorage.getItem(calendarKey) || '') as { token?: string; until?: number };
		if (!parsed.token || !parsed.until || parsed.until < Date.now()) return '';
		return parsed.token;
	} catch {
		return '';
	}
}

export function clearCalendarToken(state: { calendarToken: string } = authState) {
	state.calendarToken = '';
	sessionStorage.removeItem(calendarKey);
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
