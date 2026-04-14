import * as THREE from 'three';

export function init() {

    const canvas = document.getElementById("starsCanvasThree");
    if (!canvas) {
        console.error("Canvas starsCanvasThree introuvable");
    } else {
        const W = canvas.width;
        const H = canvas.height;

        const scene    = new THREE.Scene();
        const camera   = new THREE.PerspectiveCamera(75, W / H, 0.1, 2000);
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

        renderer.setSize(W, H);
        renderer.setPixelRatio(window.devicePixelRatio);
        camera.position.set(0, 0, 0);

        const SPREAD = 800;
        const DEPTH  = 2000;

        let geometry, material, points;

        function createStars(count) {
            if (points) {
                scene.remove(points);
                geometry.dispose();
                material.dispose();
            }

            geometry = new THREE.BufferGeometry();

            const positions = new Float32Array(count * 3);
            const colors    = new Float32Array(count * 3);
            const sizes     = new Float32Array(count);

            for (let i = 0; i < count; i++) {
                const i3 = i * 3;

                // ─────────────────────────────────────────
                // Distribution UNIFORME sur toute la profondeur
                // évite les "vagues" visibles de recyclage
                // ─────────────────────────────────────────
                positions[i3]     = (Math.random() - 0.5) * SPREAD;
                positions[i3 + 1] = (Math.random() - 0.5) * SPREAD;
                positions[i3 + 2] = -Math.random() * DEPTH;  // ← uniforme de 0 à -DEPTH

                const temp = Math.random();
                if (temp > 0.8) {
                    colors[i3] = 0.8; colors[i3+1] = 0.9; colors[i3+2] = 1.0;
                } else if (temp > 0.5) {
                    colors[i3] = 1.0; colors[i3+1] = 1.0; colors[i3+2] = 1.0;
                } else {
                    colors[i3] = 1.0; colors[i3+1] = 0.95; colors[i3+2] = 0.8;
                }

                sizes[i] = Math.random() * currentSize + 0.5;
            }

            geometry.setAttribute('position',   new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('vColorData', new THREE.BufferAttribute(colors, 3));
            geometry.setAttribute('size',       new THREE.BufferAttribute(sizes, 1));

            material = new THREE.ShaderMaterial({
                uniforms: {
                    uTime:  { value: 0 },
                    uSpeed: { value: 5 },
                },
                vertexShader: `
                    attribute float size;
                    attribute vec3 vColorData;
                    varying vec3 vColor;
                    varying float vDepth;

                    void main() {
                        vColor = vColorData;
                        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                        vDepth = -mvPosition.z;
                        gl_PointSize = size * (400.0 / -mvPosition.z);
                        gl_Position  = projectionMatrix * mvPosition;
                    }
                `,
                fragmentShader: `
                    varying vec3 vColor;
                    varying float vDepth;

                    void main() {
                        vec2 uv = gl_PointCoord - vec2(0.5);
                        float dist = length(uv);
                        if (dist > 0.5) discard;
                        float glow = pow(1.0 - smoothstep(0.0, 0.5, dist), 1.5);
                        float alpha = glow * min(1.0, vDepth / 100.0);
                        gl_FragColor = vec4(vColor * glow, alpha);
                    }
                `,
                transparent:  true,
                vertexColors: true,
                depthWrite:   false,
                blending:     THREE.AdditiveBlending,
            });

            points = new THREE.Points(geometry, material);
            scene.add(points);
        }

        // ─────────────────────────────────────────
        // ÉTAT — valeurs par défaut
        // ─────────────────────────────────────────
        let running     = true;
        let speed       = 5;
        let currentSize = 2.5;
        let currentCount = 10000;

        createStars(currentCount);

        // ─────────────────────────────────────────
        // CONTRÔLES — injection dans le DOM après le canvas
        // ─────────────────────────────────────────
        const controlsHTML = `
            <div id="starsControls" style="
                display: flex;
                gap: 16px;
                align-items: center;
                margin-top: 14px;
                background: rgba(255,255,255,0.06);
                padding: 10px 20px;
                border-radius: 30px;
                flex-wrap: wrap;
                justify-content: center;
                font-family: sans-serif;
            ">
                <label style="color:#aaa;font-size:13px;">Vitesse</label>
                <input type="range" id="starsSpeed" min="1" max="20" value="5" step="1"
                    style="width:100px;accent-color:#7f77dd;">
                <span id="starsSpeedVal" style="color:#fff;font-size:13px;min-width:20px;">5</span>

                <label style="color:#aaa;font-size:13px;">Étoiles</label>
                <input type="range" id="starsCount" min="1000" max="50000" value="10000" step="1000"
                    style="width:100px;accent-color:#7f77dd;">
                <span id="starsCountVal" style="color:#fff;font-size:13px;min-width:40px;">10000</span>

                <label style="color:#aaa;font-size:13px;">Taille</label>
                <input type="range" id="starsSize" min="0.5" max="6" value="2.5" step="0.5"
                    style="width:100px;accent-color:#7f77dd;">
                <span id="starsSizeVal" style="color:#fff;font-size:13px;min-width:20px;">2.5</span>

                <button id="starsPauseBtn" style="
                    color:#fff;
                    background:rgba(255,255,255,0.12);
                    border:1px solid rgba(255,255,255,0.2);
                    padding:5px 16px;
                    border-radius:20px;
                    cursor:pointer;
                    font-size:13px;
                ">⏸ Pause</button>
            </div>
        `;

        // Insère les contrôles juste après le canvas
        canvas.insertAdjacentHTML('afterend', controlsHTML);

        // Branchement des événements
        document.getElementById('starsSpeed').addEventListener('input', e => {
            speed = +e.target.value;
            document.getElementById('starsSpeedVal').textContent = speed;
        });

        document.getElementById('starsCount').addEventListener('input', e => {
            currentCount = +e.target.value;
            document.getElementById('starsCountVal').textContent = currentCount;
            createStars(currentCount);
        });

        document.getElementById('starsSize').addEventListener('input', e => {
            currentSize = +e.target.value;
            document.getElementById('starsSizeVal').textContent = currentSize;
            createStars(currentCount);  // recrée avec la nouvelle taille
        });

        document.getElementById('starsPauseBtn').addEventListener('click', () => {
            running = !running;
            document.getElementById('starsPauseBtn').textContent = running ? '⏸ Pause' : '▶ Play';
        });

        // ─────────────────────────────────────────
        // ANIMATION
        // ─────────────────────────────────────────
        const timer = new THREE.Timer();

        function animate() {
            requestAnimationFrame(animate);
            if (!running) return;

            timer.update();
            const delta     = timer.getDelta();
            const positions = geometry.attributes.position.array;

            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 2] += speed * delta * 60;

                // Recycler individuellement — jamais de "vague" visible
                if (positions[i + 2] > 100) {
                    positions[i]     = (Math.random() - 0.5) * SPREAD;
                    positions[i + 1] = (Math.random() - 0.5) * SPREAD;
                    positions[i + 2] = -DEPTH;  // ← repart tout au fond
                }
            }

            geometry.attributes.position.needsUpdate = true;
            renderer.render(scene, camera);
        }

        animate();
    }

}