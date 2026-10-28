import { doc, updateDoc } from 'firebase/firestore';
import { getDb } from './firebase/client';

export async function saveField(collectionName: string, id: string, field: string, value: unknown) {
	await updateDoc(doc(getDb(), collectionName, id), { [field]: value });
}

export function enableOwnerEditing(root: ParentNode) {
	const nodes = root.querySelectorAll<HTMLElement>('[data-edit-collection]');
	const stops: Array<() => void> = [];

	nodes.forEach((node) => {
		node.contentEditable = 'true';
		node.spellcheck = false;
		const onBlur = () => {
			const collectionName = node.dataset.editCollection;
			const id = node.dataset.editDoc;
			const field = node.dataset.editField;
			if (!collectionName || !id || !field) return;
			const value = node.dataset.editArray
				? [...node.querySelectorAll('p')].map((p) => p.textContent || '').filter((line) => line !== '---')
				: node.innerText.replace(/\u00a0/g, ' ').trim();
			void saveField(collectionName, id, field, value).catch(console.error);
		};
		node.addEventListener('blur', onBlur);
		stops.push(() => {
			node.removeEventListener('blur', onBlur);
			node.contentEditable = 'false';
		});
	});

	return () => stops.forEach((stop) => stop());
}
