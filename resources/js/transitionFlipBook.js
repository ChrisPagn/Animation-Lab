import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export function init() {

    (function initTransitionFlipBook() {
        const canvas = document.getElementById("transitionFlipCanvas");
        if (!canvas) { console.error("Canvas transitionFlipCanvas introuvable"); return; }

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
        renderer.setClearColor(0x050508, 1);

        camera.position.set(0, 0, 22);
        camera.lookAt(0, 0, 0);

        // ─────────────────────────────────────────
        // 2. POST-PROCESSING
        // ─────────────────────────────────────────
        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new UnrealBloomPass(
            new THREE.Vector2(W, H), 0.6, 0.4, 0.7
        ));

        // ─────────────────────────────────────────
        // 3. PAGES
        // ─────────────────────────────────────────
        const PAGES = [
            {
                title:    'ACCUEIL',
                color1:   new THREE.Color(0x001133),
                color2:   new THREE.Color(0x0066ff),
                accent:   new THREE.Color(0x00aaff),
            },
            {
                title:    'PROJETS',
                color1:   new THREE.Color(0x110022),
                color2:   new THREE.Color(0x6600cc),
                accent:   new THREE.Color(0xcc44ff),
            },
            {
                title:    'SERVICES',
                color1:   new THREE.Color(0x001108),
                color2:   new THREE.Color(0x006633),
                accent:   new THREE.Color(0x00ff88),
            },
            {
                title:    'CONTACT',
                color1:   new THREE.Color(0x110800),
                color2:   new THREE.Color(0xcc4400),
                accent:   new THREE.Color(0xff8800),
            },
        ];

        let currentPage = 0;
        let nextPage    = 0;

        // ─────────────────────────────────────────
        // 4. SHADER PAGE — contenu simulé
        // ─────────────────────────────────────────
        function createPageMaterial(pageIdx) {
            return new THREE.ShaderMaterial({
                uniforms: {
                    uColor1:  { value: PAGES[pageIdx].color1.clone() },
                    uColor2:  { value: PAGES[pageIdx].color2.clone() },
                    uAccent:  { value: PAGES[pageIdx].accent.clone() },
                    uTime:    { value: 0 },
                    uSeed:    { value: pageIdx * 3.7 },
                },
                vertexShader: `
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform vec3  uColor1;
                    uniform vec3  uColor2;
                    uniform vec3  uAccent;
                    uniform float uTime;
                    uniform float uSeed;
                    varying vec2  vUv;

                    float hash(vec2 p) {
                        return fract(sin(dot(p + uSeed, vec2(127.1, 311.7))) * 43758.5);
                    }

                    void main() {
                        // Fond dégradé
                        vec3 bg = mix(uColor1, uColor2 * 0.3, vUv.y);

                        // Ancienne barre de navigation dessinée dans le shader
                        // Désactivée pour éviter une "deuxième" navbar visuelle dans le canvas
                        float nav     = 0.0;
                        float navLine = 0.0;

                        // Hero image simulée
                        float hero = step(0.1, vUv.x) * step(vUv.x, 0.9) *
                                    step(0.6, vUv.y)  * step(vUv.y, 0.88);
                        float heroGrad = (vUv.x - 0.1) / 0.8;
                        vec3 heroCol   = mix(uColor2 * 0.5, uAccent * 0.3, heroGrad);

                        // Blocs de texte
                        float text = 0.0;
                        for (float i = 0.0; i < 6.0; i++) {
                            float y = 0.08 + i * 0.08;
                            float w = 0.2 + hash(vec2(i, 1.0)) * 0.6;
                            float x = 0.05;
                            text += step(x, vUv.x) * step(vUv.x, x + w) *
                                    step(y, vUv.y) * step(vUv.y, y + 0.025) *
                                    (0.08 + hash(vec2(i, 2.0)) * 0.12);
                        }

                        // Sidebar simulée désactivée pour la même raison (doublon visuel)
                        float sidebar = 0.0;

                        // Assemblage
                        vec3 col = bg;
                        col += uAccent * nav * 0.0;
                        col += uAccent * navLine * 0.0;
                        col  = mix(col, heroCol, hero * 0.8);
                        col += uAccent * text;
                        col += uColor2 * sidebar * 0.0;

                        // Grille subtile
                        vec2  g    = fract(vUv * 25.0);
                        float grid = smoothstep(0.48, 0.45, length(g - 0.5)) * 0.03;
                        col += uAccent * grid;

                        gl_FragColor = vec4(col, 1.0);
                    }
                `,
                side: THREE.DoubleSide,
            });
        }

        // ─────────────────────────────────────────
        // 5. PAGES 3D — deux plans qui pivotent
        // Plan A = page actuelle (face avant)
        // Plan B = page suivante (face arrière du flip)
        // ─────────────────────────────────────────
        const PAGE_W = 16;
        const PAGE_H = 10;

        const pageGeoA = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 20, 20);
        const pageGeoB = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 20, 20);

        const pageMatA = createPageMaterial(0);
        const pageMatB = createPageMaterial(1);

        const pageA = new THREE.Mesh(pageGeoA, pageMatA);
        const pageB = new THREE.Mesh(pageGeoB, pageMatB);

        // Pivot à gauche — axe de rotation vertical gauche
        pageGeoA.translate(PAGE_W / 2, 0, 0);
        pageGeoB.translate(PAGE_W / 2, 0, 0);

        pageA.position.x = -PAGE_W / 2;
        pageB.position.x = -PAGE_W / 2;

        pageB.rotation.y = Math.PI;  // face arrière au départ
        pageB.visible    = false;

        scene.add(pageA);
        scene.add(pageB);

        // ─────────────────────────────────────────
        // 6. OMBRE DE LA PAGE — plan sombre au sol
        // ─────────────────────────────────────────
        const shadowMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(PAGE_W, 1),
            new THREE.MeshBasicMaterial({
                color:       0x000000,
                transparent: true,
                opacity:     0.4,
                depthWrite:  false,
            })
        );
        shadowMesh.position.y = -PAGE_H / 2 - 0.1;
        shadowMesh.rotation.x = -Math.PI / 3;
        scene.add(shadowMesh);

        // ─────────────────────────────────────────
        // 7. PARTICULES DE BORD — éclat au pli
        // ─────────────────────────────────────────
        const SPARK_COUNT = 200;
        const sparkGeo    = new THREE.BufferGeometry();
        const sparkPos    = new Float32Array(SPARK_COUNT * 3);
        const sparkVel    = new Float32Array(SPARK_COUNT * 3);
        const sparkLife   = new Float32Array(SPARK_COUNT);

        sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));

        const sparkMat = new THREE.PointsMaterial({
            color:       0xffffff,
            size:        0.15,
            transparent: true,
            opacity:     0.8,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
        });

        const sparks    = new THREE.Points(sparkGeo, sparkMat);
        sparks.visible  = false;
        scene.add(sparks);

        let sparkIdx = 0;

        function spawnEdgeSpark(y) {
            const i = sparkIdx % SPARK_COUNT;
            sparkPos[i * 3]     = 0;   // axe de pliure = x=0
            sparkPos[i * 3 + 1] = y;
            sparkPos[i * 3 + 2] = 0.1;
            sparkVel[i * 3]     = (Math.random() - 0.5) * 0.3;
            sparkVel[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
            sparkVel[i * 3 + 2] = Math.random() * 0.3;
            sparkLife[i]        = 1.0;
            sparkIdx++;
        }

        // ─────────────────────────────────────────
        // 8. MACHINE À ÉTATS — flip
        // ─────────────────────────────────────────
        const FLIP_STATES = {
            IDLE:     'idle',
            FLIPPING: 'flipping',   // rotation 0 → -π
            SETTLING: 'settling',   // page B se stabilise
        };

        let flipState  = FLIP_STATES.IDLE;
        let flipTimer  = 0;
        let flipDir    = 1;  // 1 = suivante, -1 = précédente

        const FLIP_DURATION    = 0.9;
        const SETTLE_DURATION  = 0.2;

        function triggerFlip(direction) {
            if (flipState !== FLIP_STATES.IDLE) return;

            flipDir  = direction;
            nextPage = direction === 1
                ? (currentPage + 1) % PAGES.length
                : (currentPage - 1 + PAGES.length) % PAGES.length;

            // Met à jour la page B avec le contenu suivant
            pageMatB.uniforms.uColor1.value.copy(PAGES[nextPage].color1);
            pageMatB.uniforms.uColor2.value.copy(PAGES[nextPage].color2);
            pageMatB.uniforms.uAccent.value.copy(PAGES[nextPage].accent);
            pageMatB.uniforms.uSeed.value = nextPage * 3.7;

            pageB.visible    = true;
            sparks.visible   = true;
            flipState        = FLIP_STATES.FLIPPING;
            flipTimer        = 0;

            // Reset rotation
            pageA.rotation.y = 0;
            pageB.rotation.y = flipDir === 1 ? Math.PI : -Math.PI;
        }

        function easeInOut(t) {
            return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        }

        // Courbe de flip — accélère puis décélère
        function flipEase(t) {
            return Math.sin(t * Math.PI * 0.5);
        }

        // ─────────────────────────────────────────
        // 9. OVERLAY
        // ─────────────────────────────────────────
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: absolute;
            bottom: 15px;
            left: 50%;
            transform: translateX(-50%);
            pointer-events: none;
            text-align: center;
            font-family: monospace;
            white-space: nowrap;
        `;
        overlay.innerHTML = `
            <div id="flipTitle" style="
                font-size: 22px;
                font-weight: bold;
                color: #ffffff;
                letter-spacing: 8px;
                text-shadow: 0 0 15px rgba(0,150,255,0.8);
            ">${PAGES[0].title}</div>
            <div id="flipNav" style="
                margin-top: 6px;
                display: flex;
                gap: 6px;
                justify-content: center;
            ">
                ${PAGES.map((_, i) => `
                    <div class="flipDot" style="
                        width: 6px; height: 6px;
                        border-radius: 50%;
                        background: ${i === 0 ? '#ffffff' : 'rgba(255,255,255,0.25)'};
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
        // 10. CONTRÔLES
        // ─────────────────────────────────────────
        const controlsHTML = `
            <div id="flipControls" style="
                display:flex; gap:10px; align-items:center;
                margin-top:14px; background:rgba(5,5,15,0.95);
                padding:10px 18px; border-radius:30px;
                flex-wrap:wrap; justify-content:center;
                font-family:sans-serif;
            ">
                <button id="flipPrev" style="
                    color:#fff; background:rgba(100,100,200,0.3);
                    border:1px solid rgba(100,100,255,0.5);
                    padding:5px 16px; border-radius:20px;
                    cursor:pointer; font-size:13px;">← Précédente</button>

                <button id="flipNext" style="
                    color:#fff; background:rgba(100,100,200,0.3);
                    border:1px solid rgba(100,100,255,0.5);
                    padding:5px 16px; border-radius:20px;
                    cursor:pointer; font-size:13px;">Suivante →</button>

                <label style="color:#aabbff;font-size:13px;">Vitesse</label>
                <input type="range" id="flipSpeed" min="0.3" max="3" value="1" step="0.1"
                    style="width:80px; accent-color:#7f77dd;">
                <span id="flipSpeedVal" style="color:#fff;font-size:13px;">1</span>

                <button id="flipPauseBtn" style="
                    color:#fff; background:rgba(100,100,200,0.3);
                    border:1px solid rgba(100,100,255,0.4);
                    padding:5px 14px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⏸ Pause</button>
            </div>
        `;
        canvas.insertAdjacentHTML('afterend', controlsHTML);

        let flipSpeed = 1;
        let running   = true;

        document.getElementById('flipNext').addEventListener('click', () => {
            triggerFlip(1);
        });
        document.getElementById('flipPrev').addEventListener('click', () => {
            triggerFlip(-1);
        });
        document.getElementById('flipSpeed').addEventListener('input', e => {
            flipSpeed = +e.target.value;
            document.getElementById('flipSpeedVal').textContent = e.target.value;
        });
        document.getElementById('flipPauseBtn').addEventListener('click', () => {
            running = !running;
            document.getElementById('flipPauseBtn').textContent =
                running ? '⏸ Pause' : '▶ Play';
        });

        // ─────────────────────────────────────────
        // 11. ANIMATION
        // ─────────────────────────────────────────
        const timer   = new THREE.Timer();
        let   elapsed = 0;

        function updateOverlay() {
            document.getElementById('flipTitle').textContent =
                PAGES[currentPage].title;

            const col = PAGES[currentPage].accent;
            document.getElementById('flipTitle').style.textShadow =
                `0 0 15px rgb(${Math.round(col.r*255)},${Math.round(col.g*255)},${Math.round(col.b*255)})`;

            document.querySelectorAll('.flipDot').forEach((dot, i) => {
                dot.style.background = i === currentPage
                    ? 'rgba(255,255,255,0.9)'
                    : 'rgba(255,255,255,0.25)';
                dot.style.transform  = i === currentPage ? 'scale(1.5)' : 'scale(1)';
            });
        }

        function animate() {
            requestAnimationFrame(animate);
            if (!running) return;

            timer.update();
            const delta  = timer.getDelta();
            elapsed     += delta;
            flipTimer   += delta * flipSpeed;

            // Update temps shaders
            pageMatA.uniforms.uTime.value = elapsed;
            pageMatB.uniforms.uTime.value = elapsed;

            switch (flipState) {

                case FLIP_STATES.IDLE:
                    // Légère respiration de la page
                    pageA.rotation.y = Math.sin(elapsed * 0.5) * 0.02;
                    pageA.rotation.x = Math.sin(elapsed * 0.3) * 0.01;
                    break;

                case FLIP_STATES.FLIPPING: {
                    const t    = Math.min(1, flipTimer / FLIP_DURATION);
                    const ease = flipEase(t);

                    // Page A — tourne de 0 → -π/2 (disparaît)
                    pageA.rotation.y = flipDir * (-Math.PI / 2) * ease;

                    // Page B — tourne de π → π/2 (apparaît)
                    pageB.rotation.y = flipDir * (Math.PI - Math.PI / 2 * ease);

                    // Courbure de la page — effet physique
                    const bend = Math.sin(t * Math.PI) * 0.15;
                    pageA.rotation.z = bend * flipDir;
                    pageB.rotation.z = -bend * flipDir;

                    // Ombre — s'étire pendant le flip
                    shadowMesh.scale.x = 1 + Math.sin(t * Math.PI) * 0.3;

                    // Particules sur le bord de pliure
                    if (t > 0.2 && t < 0.8 && Math.random() < 0.4) {
                        const y = (Math.random() - 0.5) * PAGE_H;
                        spawnEdgeSpark(y);
                    }

                    if (t >= 1) {
                        flipState  = FLIP_STATES.SETTLING;
                        flipTimer  = 0;
                        // Page A devient la nouvelle page courante
                        pageMatA.uniforms.uColor1.value.copy(PAGES[nextPage].color1);
                        pageMatA.uniforms.uColor2.value.copy(PAGES[nextPage].color2);
                        pageMatA.uniforms.uAccent.value.copy(PAGES[nextPage].accent);
                        pageMatA.uniforms.uSeed.value = nextPage * 3.7;
                        pageA.rotation.y = 0;
                        pageB.visible    = false;
                        sparks.visible   = false;
                        currentPage      = nextPage;
                        updateOverlay();
                    }
                    break;
                }

                case FLIP_STATES.SETTLING: {
                    const t = Math.min(1, flipTimer / SETTLE_DURATION);

                    // Rebond léger — page A se stabilise
                    const bounce  = Math.sin(t * Math.PI) * 0.03 * (1 - t);
                    pageA.rotation.y = bounce * flipDir;
                    pageA.rotation.z = 0;
                    shadowMesh.scale.x = 1;

                    if (t >= 1) {
                        flipState        = FLIP_STATES.IDLE;
                        flipTimer        = 0;
                        pageA.rotation.y = 0;
                        pageA.rotation.z = 0;
                    }
                    break;
                }
            }

            // ── Particules de bord
            const sp = sparkGeo.attributes.position.array;
            for (let i = 0; i < SPARK_COUNT; i++) {
                if (sparkLife[i] > 0) {
                    sparkLife[i]  -= delta * 3;
                    sp[i * 3]     += sparkVel[i * 3];
                    sp[i * 3 + 1] += sparkVel[i * 3 + 1];
                    sp[i * 3 + 2] += sparkVel[i * 3 + 2];
                    sparkVel[i * 3 + 2] -= delta * 0.1;
                } else {
                    sp[i * 3 + 2] = -100;
                }
            }
            sparkGeo.attributes.position.needsUpdate = true;

            // ── Caméra — légère orbite
            camera.position.x = Math.sin(elapsed * 0.05) * 2;
            camera.position.y = Math.cos(elapsed * 0.04) * 1 + 0.5;
            camera.lookAt(0, 0, 0);

            composer.render();
        }

        animate();
    })();
}
