import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

export function init() {

    (function initParticlesLoader() {
        const canvas = document.getElementById("particlesLoaderCanvas");
        if (!canvas) { console.error("Canvas particlesLoaderCanvas introuvable"); return; }

        const W = canvas.width;
        const H = canvas.height;

        const scene    = new THREE.Scene();
        const camera   = new THREE.PerspectiveCamera(75, W / H, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

        renderer.setSize(W, H);
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.setClearColor(0x000000, 1);

        camera.position.z = 80;

        // ─────────────────────────────────────────
        // 1. PARTICULES
        // ─────────────────────────────────────────
        const COUNT     = 14000;
        const positions = new Float32Array(COUNT * 3);
        const origins   = new Float32Array(COUNT * 3);  // positions chaos
        const targets   = new Float32Array(COUNT * 3);  // positions texte
        const delays    = new Float32Array(COUNT);       // délai par particule

        // Init chaos
        for (let i = 0; i < COUNT; i++) {
            const i3 = i * 3;
            origins[i3]     = (Math.random() - 0.5) * 200;
            origins[i3 + 1] = (Math.random() - 0.5) * 200;
            origins[i3 + 2] = (Math.random() - 0.5) * 100;
            positions[i3]     = origins[i3];
            positions[i3 + 1] = origins[i3 + 1];
            positions[i3 + 2] = origins[i3 + 2];
            delays[i] = Math.random() * 0.5;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime:     { value: 0 },
                uProgress: { value: 0 },
            },
            vertexShader: `
                uniform float uTime;
                varying float vDist;

                void main() {
                    vDist = length(position);
                    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = 4.5 * (60.0 / -mvPos.z);
                    gl_Position  = projectionMatrix * mvPos;
                }
            `,
            fragmentShader: `
                uniform float uTime;
                varying float vDist;

                void main() {
                    vec2  uv   = gl_PointCoord - 0.5;
                    float dist = length(uv);
                    if (dist > 0.5) discard;

                    float glow = pow(1.0 - smoothstep(0.0, 0.5, dist), 2.0);

                    // Couleur — cyan proche, violet loin
                    vec3 colNear = vec3(0.0, 1.0, 1.0);
                    vec3 colFar  = vec3(0.6, 0.2, 1.0);
                    vec3 col     = mix(colNear, colFar, clamp(vDist / 30.0, 0.0, 1.0));

                    gl_FragColor = vec4(col * glow, glow);
                }
            `,
            transparent:  true,
            depthWrite:   false,
            blending:     THREE.AdditiveBlending,
        });

        const points = new THREE.Points(geometry, material);
        scene.add(points);

        // ─────────────────────────────────────────
        // 2. TEXTE → positions cibles
        // On échantillonne les points du TextGeometry
        // ─────────────────────────────────────────
        let targetsReady = false;

        const fontLoader = new FontLoader();
        fontLoader.load(
            'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json',
            (font) => {
                // Ligne 1
                const geo1 = new TextGeometry('SOLIDEO', {
                    font, size: 8, depth: 0.1, curveSegments: 6,
                });
                geo1.computeBoundingBox();
                const w1 = geo1.boundingBox.max.x - geo1.boundingBox.min.x;
                geo1.translate(-w1 / 2, 4, 0);

                // Ligne 2
                const geo2 = new TextGeometry('DIGITAL', {
                    font, size: 6.5, depth: 0.1, curveSegments: 6,
                });
                geo2.computeBoundingBox();
                const w2 = geo2.boundingBox.max.x - geo2.boundingBox.min.x;
                geo2.translate(-w2 / 2, -10, 0);

                // Échantillonner les points des deux géométries
                function samplePoints(geo, count) {
                    const pos    = geo.attributes.position;
                    const result = [];
                    for (let i = 0; i < count; i++) {
                        const idx = Math.floor(Math.random() * pos.count);
                        result.push(
                            pos.getX(idx) + (Math.random() - 0.5) * 0.3,
                            pos.getY(idx) + (Math.random() - 0.5) * 0.3,
                            pos.getZ(idx) + (Math.random() - 0.5) * 0.3,
                        );
                    }
                    return result;
                }

                const pts1 = samplePoints(geo1, Math.floor(COUNT * 0.5));
                const pts2 = samplePoints(geo2, Math.floor(COUNT * 0.5));
                const all  = [...pts1, ...pts2];

                for (let i = 0; i < COUNT; i++) {
                    targets[i * 3]     = all[i * 3]     ?? (Math.random() - 0.5) * 5;
                    targets[i * 3 + 1] = all[i * 3 + 1] ?? (Math.random() - 0.5) * 5;
                    targets[i * 3 + 2] = all[i * 3 + 2] ?? 0;
                }

                geo1.dispose();
                geo2.dispose();
                targetsReady = true;
            }
        );

        // ─────────────────────────────────────────
        // 3. MACHINE À ÉTATS
        // chaos → assembling → formed → exploding → chaos
        // ─────────────────────────────────────────
        const STATES = {
            CHAOS:       'chaos',
            ASSEMBLING:  'assembling',
            FORMED:      'formed',
            EXPLODING:   'exploding',
        };

        let state       = STATES.CHAOS;
        let stateTimer  = 0;
        let morphProgress = 0;

        const STATE_DURATIONS = {
            [STATES.CHAOS]:      1.5,   // attente avant assemblage
            [STATES.ASSEMBLING]: 2.5,   // durée de l'assemblage
            [STATES.FORMED]:     2.0,   // durée d'affichage
            [STATES.EXPLODING]:  1.0,   // durée explosion
        };

        // Snapshot des positions au moment de la transition
        const fromPositions = new Float32Array(COUNT * 3);
        const toPositions   = new Float32Array(COUNT * 3);

        function startTransition(newState) {
            fromPositions.set(geometry.attributes.position.array);
            state       = newState;
            stateTimer  = 0;
            morphProgress = 0;

            if (newState === STATES.ASSEMBLING) {
                toPositions.set(targets);
            } else if (newState === STATES.EXPLODING) {
                // Explosion — positions aléatoires
                for (let i = 0; i < COUNT; i++) {
                    const i3  = i * 3;
                    const r   = 20 + Math.random() * 60;
                    const theta = Math.random() * Math.PI * 2;
                    const phi   = Math.acos(2 * Math.random() - 1);
                    toPositions[i3]     = r * Math.sin(phi) * Math.cos(theta);
                    toPositions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
                    toPositions[i3 + 2] = r * Math.cos(phi) * 0.3;
                }
            } else if (newState === STATES.CHAOS) {
                toPositions.set(origins);
            }
        }

        function easeInOut(t) {
            return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        }

        // ─────────────────────────────────────────
        // 4. CONTRÔLES UI
        // ─────────────────────────────────────────
        // Clear existing controls before inserting new ones (avoid duplicates)
        const existingControls = document.getElementById('particlesLoaderControls');
        if (existingControls) existingControls.remove();

        const controlsHTML = `
            <div id="particlesLoaderControls" style="
                display:flex; gap:12px; align-items:center;
                margin-top:14px; background:rgba(0,0,10,0.95);
                padding:10px 20px; border-radius:30px;
                flex-wrap:wrap; justify-content:center;
                font-family:sans-serif;
            ">
                <label style="color:#00ffcc;font-size:13px;">Vitesse</label>
                <input type="range" id="loaderSpeed" min="0.3" max="3" value="1" step="0.1"
                    style="width:90px; accent-color:#00ffcc;">

                <button id="loaderRestartBtn" style="
                    color:#fff; background:rgba(0,200,150,0.2);
                    border:1px solid rgba(0,200,150,0.5);
                    padding:5px 14px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⟳ Relancer</button>

                <button id="loaderPauseBtn" style="
                    color:#fff; background:rgba(100,100,200,0.3);
                    border:1px solid rgba(100,100,255,0.4);
                    padding:5px 14px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⏸ Pause</button>

                <span id="loaderStateLabel" style="
                    color:#00ffcc; font-size:12px;
                    font-family:monospace; min-width:100px;">
                    État: chaos
                </span>
            </div>
        `;
        canvas.insertAdjacentHTML('afterend', controlsHTML);

        let animSpeed = 1;
        let running   = true;
        let rafId     = null;

        const speedInput   = document.getElementById('loaderSpeed');
        const restartBtn   = document.getElementById('loaderRestartBtn');
        const pauseBtn     = document.getElementById('loaderPauseBtn');
        const stateLabel   = document.getElementById('loaderStateLabel');

        if (!speedInput || !restartBtn || !pauseBtn || !stateLabel) {
            console.error('particlesLoader controls missing in DOM');
            return;
        }

        speedInput.addEventListener('input', e => {
            animSpeed = +e.target.value;
        });
        restartBtn.addEventListener('click', () => {
            // Reset positions au chaos
            for (let i = 0; i < COUNT; i++) {
                const i3 = i * 3;
                geometry.attributes.position.array[i3]     = origins[i3];
                geometry.attributes.position.array[i3 + 1] = origins[i3 + 1];
                geometry.attributes.position.array[i3 + 2] = origins[i3 + 2];
            }
            geometry.attributes.position.needsUpdate = true;
            state      = STATES.CHAOS;
            stateTimer = 0;
            morphProgress = 0;
        });
        pauseBtn.addEventListener('click', () => {
            running = !running;
            pauseBtn.textContent = running ? '⏸ Pause' : '▶ Play';
        });

        // ─────────────────────────────────────────
        // 5. ANIMATION
        // ─────────────────────────────────────────
        const timer   = new THREE.Timer();
        let   elapsed = 0;

        function animate() {
            rafId = requestAnimationFrame(animate);
            if (!running) return;

            timer.update();
            const delta  = timer.getDelta();
            elapsed     += delta;
            stateTimer  += delta * animSpeed;

            const posArr = geometry.attributes.position.array;

            // ── Machine à états
            switch (state) {
                case STATES.CHAOS:
                    // Flottement aléatoire
                    for (let i = 0; i < COUNT; i++) {
                        const i3 = i * 3;
                        posArr[i3]     += Math.sin(elapsed + i * 0.1) * 0.05;
                        posArr[i3 + 1] += Math.cos(elapsed + i * 0.07) * 0.05;
                    }
                    if (stateTimer >= STATE_DURATIONS[STATES.CHAOS] && targetsReady) {
                        startTransition(STATES.ASSEMBLING);
                    }
                    break;

                case STATES.ASSEMBLING:
                    morphProgress = Math.min(1, stateTimer / STATE_DURATIONS[STATES.ASSEMBLING]);
                    for (let i = 0; i < COUNT; i++) {
                        const i3  = i * 3;
                        const del = delays[i];
                        const tp  = Math.max(0, Math.min(1,
                            (morphProgress - del * 0.3) / (1 - del * 0.3 * 0.5)
                        ));
                        const te  = easeInOut(tp);
                        posArr[i3]     = fromPositions[i3]     + (toPositions[i3]     - fromPositions[i3])     * te;
                        posArr[i3 + 1] = fromPositions[i3 + 1] + (toPositions[i3 + 1] - fromPositions[i3 + 1]) * te;
                        posArr[i3 + 2] = fromPositions[i3 + 2] + (toPositions[i3 + 2] - fromPositions[i3 + 2]) * te;
                    }
                    if (stateTimer >= STATE_DURATIONS[STATES.ASSEMBLING]) {
                        startTransition(STATES.FORMED);
                    }
                    break;

                case STATES.FORMED:
                    // Micro flottement sur le texte formé
                    for (let i = 0; i < COUNT; i++) {
                        const i3 = i * 3;
                        posArr[i3]     = targets[i3]     + Math.sin(elapsed * 0.8 + i * 0.02) * 0.08;
                        posArr[i3 + 1] = targets[i3 + 1] + Math.cos(elapsed * 0.6 + i * 0.02) * 0.08;
                    }
                    if (stateTimer >= STATE_DURATIONS[STATES.FORMED]) {
                        startTransition(STATES.EXPLODING);
                    }
                    break;

                case STATES.EXPLODING:
                    morphProgress = Math.min(1, stateTimer / STATE_DURATIONS[STATES.EXPLODING]);
                    for (let i = 0; i < COUNT; i++) {
                        const i3 = i * 3;
                        const te = easeInOut(morphProgress);
                        posArr[i3]     = fromPositions[i3]     + (toPositions[i3]     - fromPositions[i3])     * te;
                        posArr[i3 + 1] = fromPositions[i3 + 1] + (toPositions[i3 + 1] - fromPositions[i3 + 1]) * te;
                        posArr[i3 + 2] = fromPositions[i3 + 2] + (toPositions[i3 + 2] - fromPositions[i3 + 2]) * te;
                    }
                    if (stateTimer >= STATE_DURATIONS[STATES.EXPLODING]) {
                        // Repart au chaos — boucle infinie
                        for (let i = 0; i < COUNT; i++) {
                            const i3 = i * 3;
                            origins[i3]     = (Math.random() - 0.5) * 200;
                            origins[i3 + 1] = (Math.random() - 0.5) * 200;
                            origins[i3 + 2] = (Math.random() - 0.5) * 100;
                        }
                        startTransition(STATES.CHAOS);
                    }
                    break;
            }

            geometry.attributes.position.needsUpdate = true;

            // ── Rotation lente
            points.rotation.y += 0.003;

            // ── Label état
            const labels = {
                [STATES.CHAOS]:      'chaos',
                [STATES.ASSEMBLING]: 'assemblage...',
                [STATES.FORMED]:     'formé ✓',
                [STATES.EXPLODING]:  'explosion!',
            };
            stateLabel.textContent = `État: ${labels[state]}`;

            renderer.render(scene, camera);
        }

        rafId = requestAnimationFrame(animate);

        // Module API for pause/resume/dispose
        const pause = () => { running = false; };
        const resume = () => { running = true; rafId = requestAnimationFrame(animate); };
        const dispose = () => {
            if (rafId) cancelAnimationFrame(rafId);
            const controls = document.getElementById('particlesLoaderControls');
            if (controls) controls.remove();
            renderer.dispose();
            // Libère explicitement le contexte WebGL pour éviter l'avertissement « Too many contexts »
            renderer.forceContextLoss?.();
            renderer.context = null;
            renderer.domElement = null;
            geometry.dispose();
            material.dispose();
            points.clear();
            // Font geos disposed already
        };

        return { pause, resume, dispose };
    })();

}
