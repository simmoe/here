<script lang="ts">
	import { onMount } from 'svelte';

	let host: HTMLDivElement;

	onMount(() => {
		const canvas = document.createElement('canvas');
		host.appendChild(canvas);
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		type Particle = {
			tx: number;
			ty: number;
			x: number;
			y: number;
			vx: number;
			vy: number;
			size: number;
			progress: number;
		};

		const particles: Particle[] = [];
		let opacity = 0;
		let mouseX = -9999;
		let mouseY = -9999;
		let frame = 0;
		let dead = false;
		const started = performance.now();

		const resize = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		};

		const seed = () => {
			particles.length = 0;
			const cx = canvas.width / 2;
			const cy = canvas.height / 2;
			for (let i = 0; i < 50; i += 1) {
				particles.push({
					tx: Math.random() * canvas.width,
					ty: Math.random() * canvas.height,
					x: cx,
					y: cy,
					vx: Math.random() - 0.5,
					vy: Math.random() - 0.5,
					size: 4 + Math.random() * 3,
					progress: 0
				});
			}
		};

		const limit = (vx: number, vy: number, max: number) => {
			const speed = Math.hypot(vx, vy);
			if (speed <= max || speed === 0) return { vx, vy };
			const scale = max / speed;
			return { vx: vx * scale, vy: vy * scale };
		};

		const draw = () => {
			if (dead || !ctx) return;
			const elapsed = performance.now() - started;
			if (elapsed > 500 && opacity < 1) {
				opacity = Math.min(1, opacity + 1 / 60);
			}

			ctx.clearRect(0, 0, canvas.width, canvas.height);
			const cx = canvas.width / 2;
			const cy = canvas.height / 2;

			for (const p of particles) {
				if (p.progress < 1) {
					p.progress = Math.min(1, p.progress + 0.015);
					const eased = 1 - (1 - p.progress) ** 3;
					p.x = cx + (p.tx - cx) * eased;
					p.y = cy + (p.ty - cy) * eased;
				} else {
					p.x += p.vx;
					p.y += p.vy;
					const d = Math.hypot(mouseX - p.x, mouseY - p.y);
					if (d < 150 && d > 0) {
						const nx = (p.x - mouseX) / d;
						const ny = (p.y - mouseY) / d;
						p.vx += nx * 0.1;
						p.vy += ny * 0.1;
						const limited = limit(p.vx, p.vy, 1.5);
						p.vx = limited.vx;
						p.vy = limited.vy;
					} else {
						const limited = limit(p.vx, p.vy, 0.6);
						p.vx = limited.vx;
						p.vy = limited.vy;
					}
					if (p.x < 0) p.x = canvas.width;
					if (p.x > canvas.width) p.x = 0;
					if (p.y < 0) p.y = canvas.height;
					if (p.y > canvas.height) p.y = 0;
				}

				ctx.beginPath();
				ctx.fillStyle = `rgba(0,0,0,${opacity})`;
				ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
				ctx.fill();
			}

			for (let i = 0; i < particles.length; i += 1) {
				const p = particles[i];
				if (p.progress < 0.5) continue;
				for (let j = i + 1; j < particles.length; j += 1) {
					const other = particles[j];
					if (other.progress < 0.5) continue;
					const d = Math.hypot(p.x - other.x, p.y - other.y);
					if (d >= 100 || d === 0) continue;
					const lineAlpha = opacity * 0.2 * (1 - d / 100);
					ctx.beginPath();
					ctx.strokeStyle = `rgba(0,0,0,${lineAlpha})`;
					ctx.lineWidth = 0.5;
					ctx.moveTo(p.x, p.y);
					ctx.lineTo(other.x, other.y);
					ctx.stroke();
				}
			}

			frame = requestAnimationFrame(draw);
		};

		const onMove = (event: MouseEvent) => {
			mouseX = event.clientX;
			mouseY = event.clientY;
		};
		const onResize = () => {
			resize();
		};

		resize();
		seed();
		frame = requestAnimationFrame(draw);
		window.addEventListener('mousemove', onMove);
		window.addEventListener('resize', onResize);

		return () => {
			dead = true;
			cancelAnimationFrame(frame);
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('resize', onResize);
			canvas.remove();
		};
	});
</script>

<div id="p5-container" bind:this={host}></div>
