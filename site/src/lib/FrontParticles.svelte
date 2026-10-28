<script lang="ts">
	import { onMount } from 'svelte';

	let host: HTMLDivElement;

	onMount(() => {
		let instance: { remove: () => void } | undefined;
		let dead = false;

		void import('p5').then(({ default: p5 }) => {
			if (dead) return;
			const sketch = (s: p5) => {
				const particles: Array<{
					target: p5.Vector;
					pos: p5.Vector;
					vel: p5.Vector;
					size: number;
					progress: number;
				}> = [];
				let opacity = 0;
				let started = 0;

				s.setup = () => {
					const canvas = s.createCanvas(window.innerWidth, window.innerHeight);
					canvas.parent(host);
					started = s.millis();
					for (let i = 0; i < 50; i += 1) {
						particles.push({
							target: s.createVector(s.random(s.width), s.random(s.height)),
							pos: s.createVector(s.width / 2, s.height / 2),
							vel: s.createVector(s.random(-0.5, 0.5), s.random(-0.5, 0.5)),
							size: s.random(4, 7),
							progress: 0
						});
					}
				};

				s.windowResized = () => s.resizeCanvas(window.innerWidth, window.innerHeight);

				s.draw = () => {
					if (s.millis() - started > 500 && opacity < 255) {
						opacity = Math.min(255, opacity + 255 / 60);
					}
					s.clear();
					particles.forEach((p) => {
						if (p.progress < 1) {
							p.progress = Math.min(1, p.progress + 0.015);
							const eased = 1 - (1 - p.progress) ** 3;
							p.pos = p5.Vector.lerp(s.createVector(s.width / 2, s.height / 2), p.target, eased);
						} else {
							p.pos.add(p.vel);
							const d = s.dist(s.mouseX, s.mouseY, p.pos.x, p.pos.y);
							if (d < 150) {
								const repulsion = s.createVector(p.pos.x - s.mouseX, p.pos.y - s.mouseY);
								repulsion.setMag(0.1);
								p.vel.add(repulsion);
								p.vel.limit(1.5);
							} else {
								p.vel.limit(0.6);
							}
							if (p.pos.x < 0) p.pos.x = s.width;
							if (p.pos.x > s.width) p.pos.x = 0;
							if (p.pos.y < 0) p.pos.y = s.height;
							if (p.pos.y > s.height) p.pos.y = 0;
						}
						s.noStroke();
						s.fill(0, opacity);
						s.ellipse(p.pos.x, p.pos.y, p.size);
					});
					particles.forEach((p) => {
						if (p.progress < 0.5) return;
						particles.forEach((other) => {
							if (other.progress < 0.5) return;
							const d = s.dist(p.pos.x, p.pos.y, other.pos.x, other.pos.y);
							if (d < 100) {
								s.stroke(0, s.map(d, 0, 100, opacity * 0.2, 0));
								s.strokeWeight(0.5);
								s.line(p.pos.x, p.pos.y, other.pos.x, other.pos.y);
							}
						});
					});
				};
			};
			instance = new p5(sketch);
		});

		return () => {
			dead = true;
			instance?.remove();
		};
	});
</script>

<div id="p5-container" bind:this={host}></div>
