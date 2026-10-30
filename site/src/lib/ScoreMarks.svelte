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
		display: inline-flex;
		flex: 0 0 auto;
		border: 1px solid #d1d1d6;
		border-radius: 8px;
		overflow: hidden;
		background: #f2f2f7;
	}

	button {
		flex: 0 0 2.75rem;
		width: 2.75rem;
		height: 2rem;
		margin: 0;
		padding: 0;
		background: transparent;
		color: #000;
		border: 0;
		border-right: 1px solid #d1d1d6;
		border-radius: 0;
		font: inherit;
		font-size: 17px;
		font-weight: 400;
		line-height: 2rem;
		letter-spacing: 0;
		text-transform: none;
	}

	button:last-child {
		border-right: 0;
	}

	button.on {
		background: #fff;
		font-weight: 600;
	}
</style>
