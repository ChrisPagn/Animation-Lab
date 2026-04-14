import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export function init() {

    (function initTransitionMorphPage() {
        const canvas = document.getElementById("transitionMorphCanvas");
        if (!canvas) { console.error("Canvas transitionMorphCanvas introuvable"); return; }

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

        camera.position.set(0, 0, 20);
        camera.lookAt(0, 0, 0);

        // ─────────────────────────────────────────
        // 2. POST-PROCESSING
        // Bloom + effet liquide en post
        // ─────────────────────────────────────────
        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new UnrealBloomPass(
            new THREE.Vector2(W, H), 0.8, 0.4, 0.6
        ));

        // Effet liquide — distorsion des UV
        const liquidPass = new ShaderPass({
            uniforms: {
                tDiffuse:    { value: null },
                uProgress:   { value: 0 },
                uTime:       { value: 0 },
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float     uProgress;
                uniform float     uTime;
                varying vec2      vUv;

                void main() {
                    // Ondulation — amplitude max au milieu de la transition
                    float amp = sin(uProgress * 3.14159) * 0.04;

                    vec2 distort = vec2(
                        sin(vUv.y * 15.0 + uTime * 3.0) * amp,
                        cos(vUv.x * 12.0 + uTime * 2.5) * amp
                    );

                    vec4 col = texture2D(tDiffuse, vUv + distort);
                    gl_FragColor = col;
                }
            `,
        });
        composer.addPass(liquidPass);

        // ─────────────────────────────────────────
        // 3. PAGES
        // ─────────────────────────────────────────
        const PAGES = [
            {
                title:    'ACCUEIL',
                bgColor:  new THREE.Color(0x020a18),
                color1:   new THREE.Color(0x0044aa),
                color2:   new THREE.Color(0x00aaff),
                elements: 6,
            },
            {
                title:    'PROJETS',
                bgColor:  new THREE.Color(0x100818),
                color1:   new THREE.Color(0x440088),
                color2:   new THREE.Color(0xcc44ff),
                elements: 8,
            },
            {
                title:    'SERVICES',
                bgColor:  new THREE.Color(0x081808),
                color1:   new THREE.Color(0x006622),
                color2:   new THREE.Color(0x00ff88),
                elements: 5,
            },
            {
                title:    'CONTACT',
                bgColor:  new THREE.Color(0x180808),
                color1:   new THREE.Color(0x882200),
                color2:   new THREE.Color(0xff6600),
                elements: 7,
            },
        ];

        let currentPage = 0;
        let nextPage    = 0;

        // ─────────────────────────────────────────
        // 4. PLAN PRINCIPAL — page complète
        // ShaderMaterial avec contenu simulé
        // ─────────────────────────────────────────
        const pageMat = new THREE.ShaderMaterial({
            uniforms: {
                uColor1:     { value: PAGES[0].color1.clone() },
                uColor2:     { value: PAGES[0].color2.clone() },
                uBgColor:    { value: PAGES[0].bgColor.clone() },
                uNextColor1: { value: PAGES[1].color1.clone() },
                uNextColor2: { value: PAGES[1].color2.clone() },
                uNextBg:     { value: PAGES[1].bgColor.clone() },
                uProgress:   { value: 0 },
                uTime:       { value: 0 },
            },
            vertexShader: `
                uniform float uProgress;
                uniform float uTime;
                varying vec2  vUv;
                varying float vWave;

                void main() {
                    vUv = uv;

                    vec3 pos = position;

                    // Ondulation de la géométrie — comme une page qui se liquéfie
                    float wave = sin(pos.x * 2.0 + uTime * 3.0) *
                                cos(pos.y * 1.5 + uTime * 2.0) *
                                sin(uProgress * 3.14159) * 0.8;

                    pos.z += wave;
                    vWave  = wave;

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3  uColor1;
                uniform vec3  uColor2;
                uniform vec3  uBgColor;
                uniform vec3  uNextColor1;
                uniform vec3  uNextColor2;
                uniform vec3  uNextBg;
                uniform float uProgress;
                uniform float uTime;
                varying vec2  vUv;
                varying float vWave;

                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5);
                }

                // Contenu simulé — blocs de texte et éléments UI
                float drawContent(vec2 uv, float seed) {
                    float content = 0.0;

                    // Barre de navigation
                    float nav = step(0.93, uv.y) * 0.4;

                    // Blocs de contenu — simulés
                    for (float i = 0.0; i < 5.0; i++) {
                        float y    = 0.15 + i * 0.15;
                        float w    = 0.3 + hash(vec2(i, seed)) * 0.5;
                        float x    = 0.05 + hash(vec2(i + 10.0, seed)) * (1.0 - w - 0.1);
                        float h    = 0.04 + hash(vec2(i + 20.0, seed)) * 0.04;
                        float rect = step(x, uv.x) * step(uv.x, x + w) *
                                    step(y, uv.y) * step(uv.y, y + h);
                        content   += rect * (0.1 + hash(vec2(i + 30.0, seed)) * 0.2);
                    }

                    // Élément hero — grand bloc central
                    float hero = step(0.1, uv.x) * step(uv.x, 0.9) *
                                step(0.55, uv.y) * step(uv.y, 0.88) * 0.15;
                    content += hero + nav;

                    return clamp(content, 0.0, 1.0);
                }

                void main() {
                    // Interpolation des couleurs entre les deux pages
                    vec3 bg    = mix(uBgColor,    uNextBg,     uProgress);
                    vec3 col1  = mix(uColor1,     uNextColor1, uProgress);
                    vec3 col2  = mix(uColor2,     uNextColor2, uProgress);

                    // Contenu interpolé entre les deux pages
                    float cont1 = drawContent(vUv, 1.0);
                    float cont2 = drawContent(vUv, 2.0);
                    float cont  = mix(cont1, cont2, uProgress);

                    // Couleur finale
                    vec3 pageCol = bg + col1 * cont + col2 * cont * 0.3;

                    // Vague de couleur pendant la transition
                    float waveLine = smoothstep(0.03, 0.0, abs(vWave));
                    pageCol += col2 * waveLine * 2.0;

                    // Grille de fond subtile
                    vec2  grid    = fract(vUv * 20.0);
                    float gridDot = smoothstep(0.45, 0.4, length(grid - 0.5)) * 0.05;
                    pageCol += col1 * gridDot;

                    gl_FragColor = vec4(pageCol, 1.0);
                }
            `,
            side: THREE.DoubleSide,
        });

        const pageGeo  = new THREE.PlaneGeometry(24, 14, 32, 32);
        const pageMesh = new THREE.Mesh(pageGeo, pageMat);
        scene.add(pageMesh);

        // ─────────────────────────────────────────
        // 5. ÉLÉMENTS FLOTTANTS — objets 3D par page
        // ─────────────────────────────────────────
        const floatingGroups = [];

        PAGES.forEach((page, pageIdx) => {
            const group = new THREE.Group();

            for (let i = 0; i < page.elements; i++) {
                const shapes = [
                    new THREE.BoxGeometry(0.4, 0.4, 0.4),
                    new THREE.SphereGeometry(0.25, 8, 8),
                    new THREE.TorusGeometry(0.3, 0.1, 6, 16),
                    new THREE.OctahedronGeometry(0.3),
                ];
                const geo = shapes[i % shapes.length];
                const mat = new THREE.MeshBasicMaterial({
                    color:       page.color2,
                    wireframe:   true,
                    transparent: true,
                    opacity:     0.5,
                });

                const mesh = new THREE.Mesh(geo, mat);
                const r    = 6 + Math.random() * 5;
                const a    = (i / page.elements) * Math.PI * 2;

                mesh.position.set(
                    Math.cos(a) * r,
                    Math.sin(a) * r * 0.6,
                    -2 + Math.random() * 4
                );

                mesh.userData = {
                    phase:    Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * 0.02,
                    floatAmp: 0.2 + Math.random() * 0.3,
                    floatSpd: 0.3 + Math.random() * 0.5,
                    baseX:    mesh.position.x,
                    baseY:    mesh.position.y,
                };

                group.add(mesh);
            }

            group.visible = pageIdx === 0;
            scene.add(group);
            floatingGroups.push(group);
        });

        // ─────────────────────────────────────────
        // 6. MACHINE À ÉTATS
        // ─────────────────────────────────────────
        const STATES = {
            IDLE:       'idle',
            MORPHING:   'morphing',
            COMPLETING: 'completing',
        };

        let state      = STATES.IDLE;
        let stateTimer = 0;

        const MORPH_DURATION    = 1.2;
        const COMPLETE_DURATION = 0.4;

        function triggerTransition(toPage) {
            if (state !== STATES.IDLE) return;
            nextPage   = toPage;
            state      = STATES.MORPHING;
            stateTimer = 0;

            // Prépare les couleurs cibles
            pageMat.uniforms.uNextColor1.value.copy(PAGES[nextPage].color1);
            pageMat.uniforms.uNextColor2.value.copy(PAGES[nextPage].color2);
            pageMat.uniforms.uNextBg.value.copy(PAGES[nextPage].bgColor);

            // Cache les éléments de la page actuelle
            floatingGroups[currentPage].visible = true;
            floatingGroups[nextPage].visible    = true;
        }

        function easeInOut(t) {
            return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        }

        // ─────────────────────────────────────────
        // 7. OVERLAY
        // ─────────────────────────────────────────
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: absolute;
            top: 12%;
            left: 50%;
            transform: translateX(-50%);
            pointer-events: none;
            text-align: center;
            font-family: monospace;
        `;
        overlay.innerHTML = `
            <div id="morphTitle" style="
                font-size: 32px;
                font-weight: bold;
                color: #ffffff;
                letter-spacing: 10px;
                text-shadow: 0 0 20px rgba(0,150,255,0.8);
                transition: all 0.5s ease;
            ">${PAGES[0].title}</div>
            <div id="morphDots" style="
                margin-top: 12px;
                display: flex;
                gap: 8px;
                justify-content: center;
            ">
                ${PAGES.map((_, i) => `
                    <div class="morphDot" data-idx="${i}" style="
                        width: 8px; height: 8px;
                        border-radius: 50%;
                        background: ${i === 0 ? '#ffffff' : 'rgba(255,255,255,0.2)'};
                        transition: all 0.3s;
                    "></div>
                `).join('')}
            </div>
        `;

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position: relative; display: inline-block;';
        canvas.parentNode.insertBefore(wrapper, canvas);
        wrapper.appendChild(canvas);
        wrapper.appendChild(overlay);

        // ─────────────────────────────────────────
        // 8. CONTRÔLES
        // ─────────────────────────────────────────
        const controlsHTML = `
            <div id="morphControls" style="
                display:flex; gap:10px; align-items:center;
                margin-top:14px; background:rgba(0,0,15,0.95);
                padding:10px 18px; border-radius:30px;
                flex-wrap:wrap; justify-content:center;
                font-family:sans-serif;
            ">
                <button id="morphPrev" style="
                    color:#fff; background:rgba(100,100,200,0.3);
                    border:1px solid rgba(100,100,255,0.5);
                    padding:5px 16px; border-radius:20px;
                    cursor:pointer; font-size:13px;">← Précédente</button>

                <button id="morphNext" style="
                    color:#fff; background:rgba(100,100,200,0.3);
                    border:1px solid rgba(100,100,255,0.5);
                    padding:5px 16px; border-radius:20px;
                    cursor:pointer; font-size:13px;">Suivante →</button>

                <label style="color:#aabbff;font-size:13px;">Vitesse</label>
                <input type="range" id="morphSpeed" min="0.3" max="3" value="1" step="0.1"
                    style="width:80px; accent-color:#7f77dd;">

                <label style="color:#aabbff;font-size:13px;">Intensité</label>
                <input type="range" id="morphIntensity" min="0.1" max="2" value="1" step="0.1"
                    style="width:80px; accent-color:#7f77dd;">

                <button id="morphPauseBtn" style="
                    color:#fff; background:rgba(100,100,200,0.3);
                    border:1px solid rgba(100,100,255,0.4);
                    padding:5px 14px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⏸ Pause</button>
            </div>
        `;
        canvas.insertAdjacentHTML('afterend', controlsHTML);

        let morphSpeed     = 1;
        let morphIntensity = 1;
        let running        = true;

        document.getElementById('morphNext').addEventListener('click', () => {
            triggerTransition((currentPage + 1) % PAGES.length);
        });
        document.getElementById('morphPrev').addEventListener('click', () => {
            triggerTransition((currentPage - 1 + PAGES.length) % PAGES.length);
        });
        document.getElementById('morphSpeed').addEventListener('input', e => {
            morphSpeed = +e.target.value;
        });
        document.getElementById('morphIntensity').addEventListener('input', e => {
            morphIntensity = +e.target.value;
            // Ajuste l'amplitude de la distorsion
            liquidPass.uniforms.uProgress.value;
        });
        document.getElementById('morphPauseBtn').addEventListener('click', () => {
            running = !running;
            document.getElementById('morphPauseBtn').textContent =
                running ? '⏸ Pause' : '▶ Play';
        });

        // ─────────────────────────────────────────
        // 9. ANIMATION
        // ─────────────────────────────────────────
        const timer   = new THREE.Timer();
        let   elapsed = 0;

        function updateOverlay() {
            // Titre
            const page = PAGES[currentPage];
            const col  = page.color2;
            document.getElementById('morphTitle').textContent = page.title;
            document.getElementById('morphTitle').style.textShadow =
                `0 0 20px rgb(${Math.round(col.r*255)},${Math.round(col.g*255)},${Math.round(col.b*255)})`;

            // Dots de navigation
            document.querySelectorAll('.morphDot').forEach((dot, i) => {
                dot.style.background = i === currentPage
                    ? 'rgba(255,255,255,0.9)'
                    : 'rgba(255,255,255,0.2)';
                dot.style.transform  = i === currentPage ? 'scale(1.4)' : 'scale(1)';
            });
        }

        function animate() {
            requestAnimationFrame(animate);
            if (!running) return;

            timer.update();
            const delta  = timer.getDelta();
            elapsed     += delta;
            stateTimer  += delta * morphSpeed;

            // ── Update uniforms temps
            pageMat.uniforms.uTime.value      = elapsed;
            liquidPass.uniforms.uTime.value   = elapsed;

            // ── Machine à états
            switch (state) {

                case STATES.IDLE:
                    pageMat.uniforms.uProgress.value    = 0;
                    liquidPass.uniforms.uProgress.value = 0;
                    break;

                case STATES.MORPHING: {
                    const t = Math.min(1, stateTimer / MORPH_DURATION);
                    const e = easeInOut(t);

                    pageMat.uniforms.uProgress.value    = e;
                    liquidPass.uniforms.uProgress.value = e * morphIntensity;

                    // Fondu croisé des éléments flottants
                    floatingGroups[currentPage].children.forEach(m => {
                        m.material.opacity = 0.5 * (1 - e);
                    });
                    floatingGroups[nextPage].children.forEach(m => {
                        m.material.opacity = 0.5 * e;
                    });

                    if (t >= 1) {
                        state      = STATES.COMPLETING;
                        stateTimer = 0;
                    }
                    break;
                }

                case STATES.COMPLETING: {
                    const t = Math.min(1, stateTimer / COMPLETE_DURATION);

                    liquidPass.uniforms.uProgress.value = (1 - t) * morphIntensity;

                    if (t >= 1) {
                        // Finalise la transition
                        pageMat.uniforms.uColor1.value.copy(PAGES[nextPage].color1);
                        pageMat.uniforms.uColor2.value.copy(PAGES[nextPage].color2);
                        pageMat.uniforms.uBgColor.value.copy(PAGES[nextPage].bgColor);
                        pageMat.uniforms.uProgress.value    = 0;
                        liquidPass.uniforms.uProgress.value = 0;

                        floatingGroups[currentPage].visible = false;
                        floatingGroups[nextPage].visible    = true;
                        floatingGroups[nextPage].children.forEach(m => {
                            m.material.opacity = 0.5;
                        });

                        currentPage = nextPage;
                        state       = STATES.IDLE;
                        stateTimer  = 0;

                        updateOverlay();
                    }
                    break;
                }
            }

            // ── Éléments flottants — animation continue
            floatingGroups.forEach((group, gi) => {
                if (!group.visible) return;
                group.children.forEach((mesh) => {
                    const d = mesh.userData;
                    mesh.rotation.x += d.rotSpeed;
                    mesh.rotation.y += d.rotSpeed * 0.7;
                    mesh.position.x  = d.baseX + Math.sin(elapsed * d.floatSpd + d.phase) * d.floatAmp;
                    mesh.position.y  = d.baseY + Math.cos(elapsed * d.floatSpd * 0.8 + d.phase) * d.floatAmp;
                });
            });

            // ── Caméra — léger mouvement
            camera.position.x = Math.sin(elapsed * 0.08) * 1.5;
            camera.position.y = Math.cos(elapsed * 0.06) * 0.8;
            camera.lookAt(0, 0, 0);

            composer.render();
        }

        updateOverlay();
        animate();
    })();
}