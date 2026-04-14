import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export function init() {

    (function initTransitionParticles() {
        const canvas = document.getElementById("transitionParticlesCanvas");
        if (!canvas) { console.error("Canvas transitionParticlesCanvas introuvable"); return; }

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
        renderer.setClearColor(0x000008, 1);

        camera.position.set(0, 0, 30);
        camera.lookAt(0, 0, 0);

        // ─────────────────────────────────────────
        // 2. POST-PROCESSING
        // ─────────────────────────────────────────
        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new UnrealBloomPass(
            new THREE.Vector2(W, H), 1.2, 0.5, 0.5
        ));

        // ─────────────────────────────────────────
        // 3. PAGES SIMULÉES
        // Chaque page = couleur + titre + contenu
        // ─────────────────────────────────────────
        const PAGES = [
            { title: 'ACCUEIL',   color: 0x0044ff, accent: 0x00aaff },
            { title: 'PROJETS',   color: 0x440088, accent: 0xaa44ff },
            { title: 'CONTACT',   color: 0x004422, accent: 0x00ff88 },
            { title: 'A PROPOS',  color: 0x882200, accent: 0xff6600 },
        ];

        let currentPage = 0;
        let nextPage    = 1;

        // ─────────────────────────────────────────
        // 4. PLANS DE PAGE — deux plans superposés
        // Le plan "from" se dissout en particules
        // Le plan "to" se reconstitue depuis les particules
        // ─────────────────────────────────────────
        const planeMat1 = new THREE.ShaderMaterial({
            uniforms: {
                uColor:    { value: new THREE.Color(PAGES[0].color) },
                uAccent:   { value: new THREE.Color(PAGES[0].accent) },
                uProgress: { value: 0 },
                uTime:     { value: 0 },
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3  uColor;
                uniform vec3  uAccent;
                uniform float uProgress;
                uniform float uTime;
                varying vec2  vUv;

                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5);
                }

                void main() {
                    // Grille de contenu simulé — lignes horizontales
                    float lines = step(0.95, fract(vUv.y * 12.0));
                    float cols  = step(0.92, fract(vUv.x * 8.0));
                    float grid  = max(lines, cols) * 0.15;

                    // Dissolution — chaque pixel disparaît selon son hash
                    float noise = hash(floor(vUv * 40.0));
                    float dissolve = step(noise, uProgress);

                    vec3 col = mix(uColor * 0.3 + vec3(grid), uAccent * 0.1, vUv.y);
                    col += uAccent * 0.05 * (lines + cols);

                    gl_FragColor = vec4(col, 1.0 - dissolve);
                }
            `,
            transparent: true,
            side:        THREE.DoubleSide,
            depthWrite:  false,
        });

        const planeMat2 = planeMat1.clone();
        planeMat2.uniforms = {
            uColor:    { value: new THREE.Color(PAGES[1].color) },
            uAccent:   { value: new THREE.Color(PAGES[1].accent) },
            uProgress: { value: 1 },
            uTime:     { value: 0 },
        };

        const planeGeo = new THREE.PlaneGeometry(24, 14, 1, 1);
        const plane1   = new THREE.Mesh(planeGeo, planeMat1);
        const plane2   = new THREE.Mesh(planeGeo.clone(), planeMat2);

        plane1.position.z =  0.1;
        plane2.position.z = -0.1;
        scene.add(plane1);
        scene.add(plane2);

        // ─────────────────────────────────────────
        // 5. RIDEAU DE PARTICULES
        // Tombent de haut en bas comme un rideau
        // ─────────────────────────────────────────
        const PARTICLE_COUNT = 6000;
        const partGeo        = new THREE.BufferGeometry();
        const partPos        = new Float32Array(PARTICLE_COUNT * 3);
        const partVel        = new Float32Array(PARTICLE_COUNT * 3);
        const partLife       = new Float32Array(PARTICLE_COUNT);
        const partDelay      = new Float32Array(PARTICLE_COUNT);
        const partCol        = new Float32Array(PARTICLE_COUNT * 3);

        // Init positions hors vue
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            partPos[i * 3]     = (Math.random() - 0.5) * 26;
            partPos[i * 3 + 1] = 10 + Math.random() * 20;  // au-dessus
            partPos[i * 3 + 2] = (Math.random() - 0.5) * 5;
            partVel[i * 3]     = (Math.random() - 0.5) * 0.05;
            partVel[i * 3 + 1] = -(0.08 + Math.random() * 0.12);  // vers le bas
            partVel[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
            partLife[i]        = 0;
            partDelay[i]       = Math.random();
        }

        partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
        partGeo.setAttribute('aColor',   new THREE.BufferAttribute(partCol, 3));

        const partMat = new THREE.ShaderMaterial({
            vertexShader: `
                attribute vec3 aColor;
                varying vec3   vColor;
                varying float  vLife;

                void main() {
                    vColor = aColor;
                    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = 2.0 * (25.0 / -mvPos.z);
                    gl_Position  = projectionMatrix * mvPos;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;

                void main() {
                    vec2  uv   = gl_PointCoord - 0.5;
                    float dist = length(uv);
                    if (dist > 0.5) discard;
                    float glow = pow(1.0 - smoothstep(0.0, 0.5, dist), 2.0);
                    gl_FragColor = vec4(vColor * glow, glow);
                }
            `,
            transparent:  true,
            depthWrite:   false,
            blending:     THREE.AdditiveBlending,
            vertexColors: false,
        });

        const particles = new THREE.Points(partGeo, partMat);
        scene.add(particles);
        particles.visible = false; 

        // ─────────────────────────────────────────
        // 6. MACHINE À ÉTATS DE TRANSITION
        // ─────────────────────────────────────────
        const TRANS_STATES = {
            IDLE:        'idle',        // page affichée, pas de transition
            DISSOLVING:  'dissolving',  // page actuelle se dissout
            CURTAIN:     'curtain',     // rideau de particules tombe
            FORMING:     'forming',     // nouvelle page se forme
        };

        let transState    = TRANS_STATES.IDLE;
        let transProgress = 0;
        let transTimer    = 0;

        const TRANS_DURATIONS = {
            [TRANS_STATES.DISSOLVING]: 0.8,
            [TRANS_STATES.CURTAIN]:    0.6,
            [TRANS_STATES.FORMING]:    0.8,
        };

        function triggerTransition(toPage) {
            if (transState !== TRANS_STATES.IDLE) return;
            nextPage   = toPage;
            transState = TRANS_STATES.DISSOLVING;
            transTimer = 0;

            // Prépare la page d'arrivée
            planeMat2.uniforms.uColor.value.setHex(PAGES[nextPage].color);
            planeMat2.uniforms.uAccent.value.setHex(PAGES[nextPage].accent);
            planeMat2.uniforms.uProgress.value = 1;  // invisible

            // Couleur des particules = accent de la nouvelle page
            const accentCol = new THREE.Color(PAGES[nextPage].accent);
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                partCol[i * 3]     = accentCol.r * (0.5 + Math.random() * 0.5);
                partCol[i * 3 + 1] = accentCol.g * (0.5 + Math.random() * 0.5);
                partCol[i * 3 + 2] = accentCol.b * (0.5 + Math.random() * 0.5);

                // Reset positions — toutes en haut avec délais variés
                partPos[i * 3]     = (Math.random() - 0.5) * 26;
                partPos[i * 3 + 1] = 10 + Math.random() * 15;
                partPos[i * 3 + 2] = (Math.random() - 0.5) * 3;
            }
            partGeo.attributes.aColor.needsUpdate    = true;
            partGeo.attributes.position.needsUpdate  = true;
        }

        function easeInOut(t) {
            return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        }

        // ─────────────────────────────────────────
        // 7. OVERLAY — titre de page
        // ─────────────────────────────────────────
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            text-align: center;
            font-family: monospace;
            transition: opacity 0.3s;
        `;
        overlay.innerHTML = `
            <div id="pageTitle" style="
                font-size: 38px;
                font-weight: bold;
                color: #ffffff;
                text-shadow: 0 0 20px currentColor;
                letter-spacing: 8px;
            ">${PAGES[0].title}</div>
            <div id="pageSubtitle" style="
                font-size: 12px;
                color: rgba(255,255,255,0.4);
                letter-spacing: 6px;
                margin-top: 8px;
            ">PAGE ${currentPage + 1} / ${PAGES.length}</div>
        `;

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position: relative; display: inline-block;';
        canvas.parentNode.insertBefore(wrapper, canvas);
        wrapper.appendChild(canvas);
        wrapper.appendChild(overlay);

        // ─────────────────────────────────────────
        // 8. CONTRÔLES UI
        // ─────────────────────────────────────────
        const controlsHTML = `
            <div id="transControls" style="
                display:flex; gap:10px; align-items:center;
                margin-top:14px; background:rgba(0,0,15,0.95);
                padding:10px 18px; border-radius:30px;
                flex-wrap:wrap; justify-content:center;
                font-family:sans-serif;
            ">
                <button id="transPrev" style="
                    color:#fff; background:rgba(100,100,200,0.3);
                    border:1px solid rgba(100,100,255,0.5);
                    padding:5px 16px; border-radius:20px;
                    cursor:pointer; font-size:13px;">← Précédente</button>

                <button id="transNext" style="
                    color:#fff; background:rgba(100,100,200,0.3);
                    border:1px solid rgba(100,100,255,0.5);
                    padding:5px 16px; border-radius:20px;
                    cursor:pointer; font-size:13px;">Suivante →</button>

                <label style="color:#aabbff;font-size:13px;">Vitesse</label>
                <input type="range" id="transSpeed" min="0.3" max="3" value="1" step="0.1"
                    style="width:80px; accent-color:#7f77dd;">

                <button id="transAutoBtn" style="
                    color:#fff; background:rgba(255,170,0,0.2);
                    border:1px solid rgba(255,170,0,0.4);
                    padding:5px 14px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⟳ Auto ON</button>

                <button id="transPauseBtn" style="
                    color:#fff; background:rgba(100,100,200,0.3);
                    border:1px solid rgba(100,100,255,0.4);
                    padding:5px 14px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⏸ Pause</button>
            </div>
        `;
        canvas.insertAdjacentHTML('afterend', controlsHTML);

        let transSpeed = 1;
        let running    = true;
        let autoMode   = true;
        let autoTimer  = 0;
        const AUTO_INTERVAL = 3;

        document.getElementById('transNext').addEventListener('click', () => {
            const to = (currentPage + 1) % PAGES.length;
            triggerTransition(to);
        });
        document.getElementById('transPrev').addEventListener('click', () => {
            const to = (currentPage - 1 + PAGES.length) % PAGES.length;
            triggerTransition(to);
        });
        document.getElementById('transSpeed').addEventListener('input', e => {
            transSpeed = +e.target.value;
        });
        document.getElementById('transAutoBtn').addEventListener('click', () => {
            autoMode = !autoMode;
            document.getElementById('transAutoBtn').textContent =
                autoMode ? '⟳ Auto ON' : '⟳ Auto OFF';
            autoTimer = 0;
        });
        document.getElementById('transPauseBtn').addEventListener('click', () => {
            running = !running;
            document.getElementById('transPauseBtn').textContent =
                running ? '⏸ Pause' : '▶ Play';
        });

        // ─────────────────────────────────────────
        // 9. ANIMATION
        // ─────────────────────────────────────────
        const timer   = new THREE.Timer();
        let   elapsed = 0;

        function animate() {
            requestAnimationFrame(animate);
            if (!running) return;

            timer.update();
            const delta  = timer.getDelta();
            elapsed     += delta;
            transTimer  += delta * transSpeed;

            // ── Auto transition
            if (autoMode && transState === TRANS_STATES.IDLE) {
                autoTimer += delta;
                if (autoTimer >= AUTO_INTERVAL) {
                    autoTimer = 0;
                    triggerTransition((currentPage + 1) % PAGES.length);
                }
            }

            // ── Machine à états
            switch (transState) {

                case TRANS_STATES.IDLE:
                    planeMat1.uniforms.uProgress.value = 0;
                    planeMat2.uniforms.uProgress.value = 1;
                    particles.visible = false;   // ← cachées au repos
                    break;

                case TRANS_STATES.DISSOLVING: {
                    const t = Math.min(1, transTimer / TRANS_DURATIONS[TRANS_STATES.DISSOLVING]);
                    planeMat1.uniforms.uProgress.value = easeInOut(t);
                    planeMat1.uniforms.uTime.value     = elapsed;
                    particles.visible = false;   // ← pas encore visibles

                    if (t >= 1) {
                        transState = TRANS_STATES.CURTAIN;
                        transTimer = 0;
                    }
                    break;
                }

                case TRANS_STATES.CURTAIN: {
                    const t = Math.min(1, transTimer / TRANS_DURATIONS[TRANS_STATES.CURTAIN]);
                    particles.visible = true;    // ← apparaissent pendant le rideau

                    const pp = partGeo.attributes.position.array;
                    for (let i = 0; i < PARTICLE_COUNT; i++) {
                        const i3     = i * 3;
                        const active = partDelay[i] < t;
                        if (active) {
                            pp[i3 + 1] += partVel[i * 3 + 1] * transSpeed * 1.5;
                            pp[i3]     += partVel[i * 3]     * 0.5;
                        }
                    }
                    partGeo.attributes.position.needsUpdate = true;

                    if (t >= 1) {
                        transState = TRANS_STATES.FORMING;
                        transTimer = 0;
                        planeMat1.uniforms.uColor.value.setHex(PAGES[nextPage].color);
                        planeMat1.uniforms.uAccent.value.setHex(PAGES[nextPage].accent);
                        planeMat1.uniforms.uProgress.value = 1;
                    }
                    break;
                }

                case TRANS_STATES.FORMING: {
                    const t = Math.min(1, transTimer / TRANS_DURATIONS[TRANS_STATES.FORMING]);
                    particles.visible = true;    // ← encore visibles pendant la formation

                    planeMat1.uniforms.uProgress.value = 1 - easeInOut(t);
                    planeMat1.uniforms.uTime.value     = elapsed;

                    const pp = partGeo.attributes.position.array;
                    for (let i = 0; i < PARTICLE_COUNT; i++) {
                        pp[i * 3 + 1] += partVel[i * 3 + 1] * transSpeed;
                    }
                    partGeo.attributes.position.needsUpdate = true;

                    if (t >= 1) {
                        particles.visible = false;   // ← cachées dès la fin
                        transState   = TRANS_STATES.IDLE;
                        transTimer   = 0;
                        currentPage  = nextPage;
                        autoTimer    = 0;

                        document.getElementById('pageTitle').textContent =
                            PAGES[currentPage].title;
                        document.getElementById('pageSubtitle').textContent =
                            `PAGE ${currentPage + 1} / ${PAGES.length}`;

                        const accentHex = PAGES[currentPage].accent;
                        const col = new THREE.Color(accentHex);
                        document.getElementById('pageTitle').style.color =
                            `rgb(${Math.round(col.r*255)},${Math.round(col.g*255)},${Math.round(col.b*255)})`;
                    }
                    break;
                }
            }


            // ── Lumière ambiante — couleur de la page courante
            renderer.setClearColor(
                new THREE.Color(PAGES[currentPage].color).multiplyScalar(0.08), 1
            );

            composer.render();
        }

        animate();
    })();
}