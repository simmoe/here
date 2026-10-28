<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	$effect(() => {
		const id = page.params.id;
		const studentId = page.params.studentId;
		if (!id || !studentId) return;
		void goto(`/work/hold/${id}#${studentId}`, { replaceState: true });
	});
</script>
