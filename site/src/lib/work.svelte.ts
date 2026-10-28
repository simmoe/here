import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { getDb } from './firebase/client';

export type Field = { key: string; label: string; kind: string };
export type ClassItem = {
	id: string;
	title: string;
	order?: number;
	year?: string;
	subject?: string;
	level?: string;
	fields?: Field[];
};
export type Student = { id: string; name: string; birthDate?: string };
export type Enrollment = {
	id: string;
	classId: string;
	studentId: string;
	studyLine?: string;
	groups?: string[];
	values?: Record<string, string>;
};
export type Group = {
	id: string;
	classId: string;
	projectName: string;
	studentIds: string[];
	boardUrl?: string;
	fields?: Field[];
	values?: Record<string, string>;
};
export type Note = { id: string; title?: string; body?: string; updatedAt?: { seconds?: number } };

class WorkData {
	classes = $state<ClassItem[]>([]);
	students = $state<Student[]>([]);
	enrollments = $state<Enrollment[]>([]);
	groups = $state<Group[]>([]);
	notes = $state<Note[]>([]);
	#stops: Unsubscribe[] = [];

	listen() {
		if (this.#stops.length) return;
		const db = getDb();
		const take = <T>(path: string, apply: (rows: T[]) => void) =>
			onSnapshot(collection(db, path), (snap) => {
				apply(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as T));
			});
		this.#stops = [
			take<ClassItem>('here_private_classes', (rows) => {
				this.classes = rows.sort((a, b) => (a.order || 0) - (b.order || 0));
			}),
			take<Student>('here_private_students', (rows) => {
				this.students = rows;
			}),
			take<Enrollment>('here_private_enrollments', (rows) => {
				this.enrollments = rows;
			}),
			take<Group>('here_private_groups', (rows) => {
				this.groups = rows;
			}),
			take<Note>('here_private_notes', (rows) => {
				this.notes = rows.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
			})
		];
	}

	student(id: string) {
		return this.students.find((item) => item.id === id);
	}

	enrollmentsFor(classId: string) {
		return this.enrollments
			.filter((item) => item.classId === classId)
			.map((enrollment) => ({ enrollment, student: this.student(enrollment.studentId) }))
			.sort((a, b) => (a.student?.name || '').localeCompare(b.student?.name || '', 'da'));
	}
}

export const workData = new WorkData();

export function formatDate(iso?: string) {
	if (!iso) return '';
	const [year, month, day] = iso.split('-');
	return day ? `${day}.${month}.${year}` : iso;
}
