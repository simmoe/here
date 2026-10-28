<script lang="ts">
	let { value = '', onpick }: { value?: string; onpick: (value: string) => void } = $props();

	const marks = ['0', '1', '2', '3', '4', '5'];
</script>

<div class="marks" role="radiogroup">
	{#each marks as mark}
		<button
			type="button"
			role="radio"
			aria-checked={value === mark}
			class:on={value === mark}
			onclick={() => onpick(value === mark ? '' : mark)}
		>{mark}</button>
	{/each}
</div>

<style>
	.marks {
		display: flex;
		width: 100%;
		gap: 0.35rem;
	}

	button {
		flex: 1;
		height: auto;
		margin: 0;
		padding: 0.15rem 0 0.2rem;
		background: transparent;
		color: #9e9e9e;
		border: 0;
		border-bottom: 1px solid #e0e0e0;
		border-radius: 0;
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 400;
		line-height: 1.4;
		letter-spacing: 0;
		text-transform: none;
	}

	button.on {
		color: #000;
		border-bottom-color: #000;
		font-weight: 500;
	}
</style>
