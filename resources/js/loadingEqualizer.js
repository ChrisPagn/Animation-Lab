import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

export function init() {

    (function initLoadingEqualizer() {
        const canvas = document.getElementById("loadingEqualizerCanvas");
        if (!canvas) { console.error("Canvas loadingEqualizerCanvas introuvable"); return; }

        const W = canvas.width;
        const H = canvas.height;

        // ─────────────────────────────────────────
        // 1. SETUP
        // ─────────────────────────────────────────
        const scene    = new THREE.Scene();
        const camera   = new THREE.PerspectiveCamera(60, W / H, 0.1, 500);
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

        renderer.setSize(W, H);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0x010108, 1);

        camera.position.set(0, 8, 35);
        camera.lookAt(0, 0, 0);

        // ─────────────────────────────────────────
        // 2. POST-PROCESSING
        // ─────────────────────────────────────────
        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new UnrealBloomPass(
            new THREE.Vector2(W, H), 1.5, 0.5, 0.4
        ));

        // ─────────────────────────────────────────
        // 3. BRUIT DE SIMPLEX — hauteurs organiques
        // ─────────────────────────────────────────
        const simplex = new SimplexNoise();

        // ─────────────────────────────────────────
        // 4. BARRES DE L'EQUALIZER
        // ─────────────────────────────────────────
        const BAR_COUNT  = 48;
        const BAR_WIDTH  = 0.6;
        const BAR_GAP    = 0.25;
        const BAR_STEP   = BAR_WIDTH + BAR_GAP;
        const MAX_HEIGHT = 12;

        const offsetX = -(BAR_COUNT * BAR_STEP) / 2 + BAR_STEP / 2;

        const bars      = [];
        const barLights = [];

        // Palette — chaque barre a sa teinte selon sa position
        function barColor(index, height, progress) {
            const t = index / BAR_COUNT;

            // Couleur de base — dégradé horizontal
            const baseHue = 180 + t * 80;   // cyan → bleu/violet

            // Luminosité selon hauteur
            const lightness = 30 + (height / MAX_HEIGHT) * 50;

            // Saturation diminue avec le progrès (devient blanc à 100%)
            const saturation = 100 - progress * 40;

            return new THREE.Color(
                `hsl(${baseHue}, ${saturation}%, ${lightness}%)`
            );
        }

        for (let i = 0; i < BAR_COUNT; i++) {
            const x = offsetX + i * BAR_STEP;

            // Géométrie de la barre — hauteur initiale 1
            const geo = new THREE.BoxGeometry(BAR_WIDTH, 1, BAR_WIDTH);

            // Pivot en bas — scale Y depuis le bas
            geo.translate(0, 0.5, 0);

            const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(`hsl(${180 + (i / BAR_COUNT) * 80}, 100%, 50%)`),
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, -8, 0);
            scene.add(mesh);

            // Reflet — même barre mais en dessous, miroir inversé
            const reflectMat = new THREE.MeshBasicMaterial({
                color:       new THREE.Color(0x001122),
                transparent: true,
                opacity:     0.3,
            });
            const reflect = new THREE.Mesh(geo.clone(), reflectMat);
            reflect.position.set(x, -8, 0);
            reflect.scale.y = -0.3;   // miroir aplati
            scene.add(reflect);

            // Lumière ponctuelle au sommet de chaque barre
            const light = new THREE.PointLight(0x00ffcc, 0, 8);
            light.position.set(x, -8, 0);
            scene.add(light);
            barLights.push(light);

            bars.push({
                mesh,
                reflect,
                light,
                x,
                currentHeight: 0.1,
                targetHeight:  0.1,
                phase:         i * 0.4 + Math.random() * Math.PI,
                speed:         0.5 + Math.random() * 0.8,
            });
        }

        // ─────────────────────────────────────────
        // 5. SOL RÉFLÉCHISSANT
        // ─────────────────────────────────────────
        const floorMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                varying vec2  vUv;

                void main() {
                    // Grille de points lumineux
                    vec2 grid = fract(vUv * 30.0);
                    float dot = length(grid - 0.5);
                    float gridLight = smoothstep(0.45, 0.4, dot) * 0.15;

                    // Reflet flou des barres
                    float reflex = (1.0 - vUv.y) * 0.08;

                    vec3 col = vec3(0.0, gridLight + reflex, gridLight * 2.0 + reflex);
                    gl_FragColor = vec4(col, 0.8);
                }
            `,
            transparent: true,
            depthWrite:  false,
        });

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(50, 20),
            floorMat
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -8;
        scene.add(floor);

        // ─────────────────────────────────────────
        // 6. PARTICULES — étincelles au sommet des barres
        // ─────────────────────────────────────────
        const sparkCount = 300;
        const sparkGeo   = new THREE.BufferGeometry();
        const sparkPos   = new Float32Array(sparkCount * 3);
        const sparkVel   = new Float32Array(sparkCount * 3);
        const sparkLife  = new Float32Array(sparkCount);
        const sparkActive = new Uint8Array(sparkCount);

        sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));

        const sparkMat = new THREE.PointsMaterial({
            color:       0x00ffcc,
            size:        0.2,
            transparent: true,
            opacity:     0.8,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
        });

        scene.add(new THREE.Points(sparkGeo, sparkMat));

        let sparkIdx = 0;

        function spawnSpark(x, y) {
            const i = sparkIdx % sparkCount;
            sparkPos[i * 3]     = x + (Math.random() - 0.5) * BAR_WIDTH;
            sparkPos[i * 3 + 1] = y;
            sparkPos[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
            sparkVel[i * 3]     = (Math.random() - 0.5) * 0.15;
            sparkVel[i * 3 + 1] = Math.random() * 0.2 + 0.1;
            sparkVel[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
            sparkLife[i]        = 1.0;
            sparkActive[i]      = 1;
            sparkIdx++;
        }

        // ─────────────────────────────────────────
        // 7. ÉTAT DU CHARGEMENT
        // ─────────────────────────────────────────
        let progress     = 0;
        let loadInterval = null;
        let resetTimer   = null;

        function startLoading() {
            if (loadInterval) clearInterval(loadInterval);
            if (resetTimer)   clearTimeout(resetTimer);

            progress = 0;

            loadInterval = setInterval(() => {
                progress += Math.random() * 0.02 + 0.005;
                if (progress >= 1) {
                    progress = 1;
                    clearInterval(loadInterval);
                    loadInterval = null;

                    // Relance automatique après 1.5s
                    resetTimer = setTimeout(() => startLoading(), 1500);
                }
            }, 80);
        }

        startLoading();

        // ─────────────────────────────────────────
        // 8. OVERLAY PROGRESSION
        // ─────────────────────────────────────────
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: absolute;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            pointer-events: none;
            text-align: center;
            font-family: monospace;
            white-space: nowrap;
        `;
        overlay.innerHTML = `
            <div id="eqPercent" style="
                font-size: 36px;
                font-weight: bold;
                color: #00ffcc;
                text-shadow: 0 0 15px #00ffcc;
                letter-spacing: 6px;
            ">0%</div>
            <div id="eqLabel" style="
                font-size: 11px;
                color: #334455;
                letter-spacing: 8px;
                margin-top: 4px;
            ">CHARGEMENT EN COURS</div>
        `;

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position: relative; display: inline-block;';
        canvas.parentNode.insertBefore(wrapper, canvas);
        wrapper.appendChild(canvas);
        wrapper.appendChild(overlay);

        // ─────────────────────────────────────────
        // 9. CONTRÔLES UI
        // ─────────────────────────────────────────
        const controlsHTML = `
            <div id="eqControls" style="
                display:flex; gap:12px; align-items:center;
                margin-top:14px; background:rgba(1,1,15,0.95);
                padding:10px 20px; border-radius:30px;
                flex-wrap:wrap; justify-content:center;
                font-family:sans-serif;
            ">
                <label style="color:#00ffcc;font-size:13px;">Amplitude</label>
                <input type="range" id="eqAmp" min="0.2" max="3" value="1" step="0.1"
                    style="width:80px; accent-color:#00ffcc;">

                <label style="color:#00ffcc;font-size:13px;">Vitesse</label>
                <input type="range" id="eqSpeed" min="0.2" max="4" value="1" step="0.1"
                    style="width:80px; accent-color:#00ffcc;">

                <label style="color:#00ffcc;font-size:13px;">Bloom</label>
                <input type="range" id="eqBloom" min="0" max="3" value="1.5" step="0.1"
                    style="width:80px; accent-color:#00ffcc;">

                <button id="eqRestartBtn" style="
                    color:#fff; background:rgba(0,200,150,0.2);
                    border:1px solid rgba(0,200,150,0.5);
                    padding:5px 14px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⟳ Relancer</button>

                <button id="eqPauseBtn" style="
                    color:#fff; background:rgba(100,100,200,0.3);
                    border:1px solid rgba(100,100,255,0.4);
                    padding:5px 14px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⏸ Pause</button>
            </div>
        `;
        canvas.insertAdjacentHTML('afterend', controlsHTML);

        let eqAmp   = 1;
        let eqSpeed = 1;
        let running = true;

        document.getElementById('eqAmp').addEventListener('input', e => {
            eqAmp = +e.target.value;
        });
        document.getElementById('eqSpeed').addEventListener('input', e => {
            eqSpeed = +e.target.value;
        });
        document.getElementById('eqBloom').addEventListener('input', e => {
            composer.passes[1].strength = +e.target.value;
        });
        document.getElementById('eqRestartBtn').addEventListener('click', () => {
            startLoading();
        });
        document.getElementById('eqPauseBtn').addEventListener('click', () => {
            running = !running;
            document.getElementById('eqPauseBtn').textContent =
                running ? '⏸ Pause' : '▶ Play';
        });

        // ─────────────────────────────────────────
        // 10. ANIMATION
        // ─────────────────────────────────────────
        const timer   = new THREE.Timer();
        let   elapsed = 0;
        let   prevHeights = new Float32Array(BAR_COUNT);

        function animate() {
            requestAnimationFrame(animate);
            if (!running) return;

            timer.update();
            const delta  = timer.getDelta();
            elapsed     += delta * eqSpeed;

            // ── Calcul des hauteurs avec Simplex
        bars.forEach((bar, i) => {
                const t = i / BAR_COUNT;

                // ── Seuil d'activation — chaque barre a son index de déclenchement
                // La barre i s'allume quand progress dépasse son seuil
                const activationThreshold = i / BAR_COUNT;
                const isActive = progress >= activationThreshold;

                // Intensité locale — 0→1 progressivement après activation
                const localProgress = isActive
                    ? Math.min(1, (progress - activationThreshold) / (1 / BAR_COUNT) * 2)
                    : 0;

                let height;

                if (!isActive) {
                    // ── Barre inactive — quasi à plat avec micro pulsation
                    height = 0.1 + Math.sin(elapsed * bar.speed + bar.phase) * 0.05;

                } else if (progress < 1) {
                    // ── Barre active en cours — oscille avec amplitude croissante
                    const noise  = simplex.noise(t * 3 + elapsed * 0.5, elapsed * 0.3);
                    const noise2 = simplex.noise(t * 5 - elapsed * 0.4, elapsed * 0.2 + 10);

                    // Amplitude proportionnelle au progress local
                    const oscAmp = MAX_HEIGHT * localProgress * eqAmp * 0.8;
                    height = Math.max(0.2,
                        oscAmp * 0.4
                        + (noise * 0.6 + noise2 * 0.4) * oscAmp * 0.6
                        + Math.sin(elapsed * bar.speed + bar.phase) * oscAmp * 0.3
                    );

                } else {
                    // ── 100% — toutes les barres au maximum
                    // Chaque barre pulse à sa hauteur max
                    const noise = simplex.noise(t * 3 + elapsed * 0.3, elapsed * 0.2);
                    height = MAX_HEIGHT * (0.85 + noise * 0.15) * eqAmp;
                }

                // Lerp fluide vers la hauteur cible
                bar.currentHeight += (height - bar.currentHeight) * 0.12;
                bar.mesh.scale.y   = Math.max(0.01, bar.currentHeight);
                bar.reflect.scale.y = -Math.max(0.01, bar.currentHeight) * 0.25;

                // ── Couleur selon état
                let col;
                if (!isActive) {
                    // Éteinte — gris très sombre
                    col = new THREE.Color(0x050510);
                } else if (progress < 1) {
                    // Active — dégradé selon progress local
                    col = barColor(i, bar.currentHeight * localProgress, progress);
                } else {
                    // 100% — pleine luminosité + teinte chaude
                    const hue = 180 + t * 60 + Math.sin(elapsed * 2 + i * 0.2) * 10;
                    col = new THREE.Color().setHSL(hue / 360, 1.0, 0.6);
                }

                bar.mesh.material.color.copy(col);
                bar.reflect.material.color.copy(col).multiplyScalar(0.3);

                // ── Lumière au sommet
                const topY = -8 + bar.currentHeight;
                bar.light.position.y  = topY;
                bar.light.intensity   = isActive
                    ? (bar.currentHeight / MAX_HEIGHT) * 2 * localProgress
                    : 0;
                bar.light.color.copy(col);

                // ── Étincelles — uniquement sur les barres actives hautes
                if (isActive && bar.currentHeight > MAX_HEIGHT * 0.65 * eqAmp
                    && Math.random() < 0.08) {
                    spawnSpark(bar.x, topY);
                }

                // ── Explosion d'étincelles à 100%
                if (progress >= 1 && Math.random() < 0.25) {
                    spawnSpark(
                        bar.x + (Math.random() - 0.5) * BAR_WIDTH,
                        -8 + Math.random() * bar.currentHeight
                    );
                }
            });

            // ── Particules étincelles
            const sp = sparkGeo.attributes.position.array;
            for (let i = 0; i < sparkCount; i++) {
                if (sparkLife[i] > 0) {
                    sparkLife[i]  -= delta * 2.5;
                    sp[i * 3]     += sparkVel[i * 3];
                    sp[i * 3 + 1] += sparkVel[i * 3 + 1];
                    sp[i * 3 + 2] += sparkVel[i * 3 + 2];
                    sparkVel[i * 3 + 1] -= delta * 0.15;  // gravité
                } else {
                    sp[i * 3 + 2] = -100;  // cache la particule
                }
            }
            sparkGeo.attributes.position.needsUpdate = true;

            // ── Caméra — légère oscillation + zoom arrière à la fin
            const targetZ = 35 + progress * 10;
            camera.position.z += (targetZ - camera.position.z) * 0.02;
            camera.position.x  = Math.sin(elapsed * 0.08) * 3;
            camera.lookAt(0, 2, 0);

            // ── Floor shader
            floorMat.uniforms.uTime.value = elapsed;

            // ── Overlay
            const pct = Math.round(progress * 100);
            document.getElementById('eqPercent').textContent = pct + '%';

            // Couleur finale — blanc à 100%
            const hue = 180 - progress * 40;
            const lit = 50 + progress * 30;
            document.getElementById('eqPercent').style.color =
                `hsl(${hue}, 100%, ${lit}%)`;
            document.getElementById('eqPercent').style.textShadow =
                `0 0 ${15 + progress * 20}px hsl(${hue}, 100%, ${lit}%)`;

            if (progress >= 1) {
                document.getElementById('eqLabel').textContent    = 'CHARGEMENT TERMINÉ';
                document.getElementById('eqLabel').style.color    = '#00ffcc';
                document.getElementById('eqLabel').style.letterSpacing = '10px';
            } else {
                document.getElementById('eqLabel').textContent    = 'CHARGEMENT EN COURS';
                document.getElementById('eqLabel').style.color    = '#334455';
                document.getElementById('eqLabel').style.letterSpacing = '8px';
            }

            composer.render();
        }

        animate();
    })();
}