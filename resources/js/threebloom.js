import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export function init() {

    const canvas = document.getElementById("bloomCanvas");

    if (!canvas) {
        console.error("Canvas bloomCanvas introuvable");
    } else {
        const W = canvas.width;
        const H = canvas.height;

        // ─────────────────────────────────────────
        // 1. SETUP
        // ─────────────────────────────────────────
        const scene    = new THREE.Scene();
        const camera   = new THREE.PerspectiveCamera(70, W / H, 0.1, 500);
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

        renderer.setSize(W, H);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0x000000, 1);
        renderer.toneMapping        = THREE.ReinhardToneMapping;
        renderer.toneMappingExposure = 1.5;

        camera.position.set(0, 0, 40);
        camera.lookAt(0, 0, 0);

        // ─────────────────────────────────────────
        // 2. POST-PROCESSING — EffectComposer
        // Le rendu passe par une chaîne d'effets
        // avant d'arriver à l'écran
        // ─────────────────────────────────────────

        // RenderPass — rendu normal de la scène
        const renderPass = new RenderPass(scene, camera);

        // UnrealBloomPass — fait "saigner" la lumière
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(W, H),
            1.5,    // strength  — intensité du bloom
            0.4,    // radius    — rayon de diffusion
            0.85    // threshold — seuil de luminosité déclencheur
        );

        // Aberration chromatique — sépare les canaux RGB
        const chromaPass = new ShaderPass({
            uniforms: {
                tDiffuse: { value: null },
                uStrength: { value: 0.003 },
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
                uniform sampler2D tDiffuse;
                uniform float     uStrength;
                uniform float     uTime;
                varying vec2      vUv;

                void main() {
                    // Décale les canaux R, G, B dans des directions légèrement différentes
                    vec2 offset = vec2(uStrength + sin(uTime * 0.5) * 0.001);

                    float r = texture2D(tDiffuse, vUv + offset).r;
                    float g = texture2D(tDiffuse, vUv).g;
                    float b = texture2D(tDiffuse, vUv - offset).b;

                    // Vignette — assombrit les bords de l'écran
                    float dist     = length(vUv - 0.5) * 2.0;
                    float vignette = 1.0 - smoothstep(0.5, 1.4, dist);

                    gl_FragColor = vec4(r, g, b, 1.0) * vignette;
                }
            `,
        });

        // Assemblage de la chaîne de post-processing
        const composer = new EffectComposer(renderer);
        composer.addPass(renderPass);
        composer.addPass(bloomPass);
        composer.addPass(chromaPass);   // toujours en dernier

        // ─────────────────────────────────────────
        // 3. SCÈNE — galaxie spirale
        // ─────────────────────────────────────────

        // Noyau central brillant
        const coreGeo = new THREE.SphereGeometry(1.5, 32, 32);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const core    = new THREE.Mesh(coreGeo, coreMat);
        scene.add(core);

        // Halo du noyau
        const haloGeo = new THREE.SphereGeometry(3, 32, 32);
        const haloMat = new THREE.MeshBasicMaterial({
            color:       0xaaaaff,
            transparent: true,
            opacity:     0.15,
        });
        scene.add(new THREE.Mesh(haloGeo, haloMat));

        // ─────────────────────────────────────────
        // 4. BRAS SPIRAUX — particules
        // ─────────────────────────────────────────
        function createGalaxyArm(armIndex, totalArms, count) {
            const geo      = new THREE.BufferGeometry();
            const pos      = new Float32Array(count * 3);
            const colArr   = new Float32Array(count * 3);

            const armAngle = (armIndex / totalArms) * Math.PI * 2;

            for (let i = 0; i < count; i++) {
                const i3 = i * 3;

                // Distance du centre — distribution non linéaire
                const t      = Math.pow(Math.random(), 0.5);  // plus dense au centre
                const radius = t * 20;

                // Angle spiral — plus on est loin, plus on tourne
                const spin   = radius * 0.35;
                const angle  = armAngle + spin + (Math.random() - 0.5) * 0.5;

                // Dispersion — les bras ne sont pas parfaits
                const scatter = (1 - t) * 0.5 + Math.random() * 0.3;

                pos[i3]     = Math.cos(angle) * radius + (Math.random() - 0.5) * scatter * 3;
                pos[i3 + 1] = (Math.random() - 0.5) * (1 - t) * 2;  // aplati en Y
                pos[i3 + 2] = Math.sin(angle) * radius + (Math.random() - 0.5) * scatter * 3;

                // Couleur — blanc au centre, bleuté/rougeâtre aux extrémités
                const proximity = 1 - t;
                if (armIndex % 2 === 0) {
                    // Bras pairs — bleutés
                    colArr[i3]     = 0.4 + proximity * 0.6;
                    colArr[i3 + 1] = 0.5 + proximity * 0.5;
                    colArr[i3 + 2] = 1.0;
                } else {
                    // Bras impairs — dorés
                    colArr[i3]     = 1.0;
                    colArr[i3 + 1] = 0.6 + proximity * 0.4;
                    colArr[i3 + 2] = 0.2 + proximity * 0.3;
                }
            }

            geo.setAttribute('position', new THREE.BufferAttribute(pos,    3));
            geo.setAttribute('aColor',   new THREE.BufferAttribute(colArr, 3));

            const mat = new THREE.ShaderMaterial({
                uniforms: {
                    uTime:    { value: 0 },
                    uArmIdx:  { value: armIndex },
                },
                vertexShader: `
                    attribute vec3 aColor;
                    uniform float uTime;
                    uniform float uArmIdx;
                    varying vec3  vColor;
                    varying float vBrightness;

                    void main() {
                        vColor = aColor;

                        // Rotation lente de la galaxie
                        float dist  = length(position.xz);
                        float speed = 0.05 / (dist + 1.0);  // plus vite au centre
                        float angle = uTime * speed;

                        float c = cos(angle);
                        float s = sin(angle);
                        vec3 rotPos = vec3(
                            c * position.x - s * position.z,
                            position.y,
                            s * position.x + c * position.z
                        );

                        // Luminosité liée à la distance (halo central)
                        vBrightness = 1.0 / (dist * 0.1 + 0.5);

                        vec4 mvPos = modelViewMatrix * vec4(rotPos, 1.0);
                        gl_PointSize = (1.5 + vBrightness * 2.0) * (30.0 / -mvPos.z);
                        gl_Position  = projectionMatrix * mvPos;
                    }
                `,
                fragmentShader: `
                    varying vec3  vColor;
                    varying float vBrightness;

                    void main() {
                        vec2  uv   = gl_PointCoord - 0.5;
                        float dist = length(uv);
                        if (dist > 0.5) discard;

                        float glow = pow(1.0 - smoothstep(0.0, 0.5, dist), 2.0);
                        vec3  col  = vColor * glow * (0.8 + vBrightness * 0.5);

                        gl_FragColor = vec4(col, glow * 0.9);
                    }
                `,
                transparent:  true,
                vertexColors: false,
                depthWrite:   false,
                blending:     THREE.AdditiveBlending,
            });

            return { geo, mat, points: new THREE.Points(geo, mat) };
        }

        // Créer 4 bras spiraux
        const arms = [];
        for (let i = 0; i < 4; i++) {
            const arm = createGalaxyArm(i, 4, 3000);
            scene.add(arm.points);
            arms.push(arm);
        }

        // ─────────────────────────────────────────
        // 5. ÉTOILES DE FOND
        // ─────────────────────────────────────────
        const bgGeo = new THREE.BufferGeometry();
        const bgPos = new Float32Array(5000 * 3);
        for (let i = 0; i < 5000 * 3; i++) {
            bgPos[i] = (Math.random() - 0.5) * 400;
        }
        bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));

        scene.add(new THREE.Points(bgGeo, new THREE.PointsMaterial({
            color:       0xffffff,
            size:        0.05,
            transparent: true,
            opacity:     0.4,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
        })));

        // ─────────────────────────────────────────
        // 6. NÉBULEUSES — plans transparents colorés
        // ─────────────────────────────────────────
        const nebulaColors = [0x3311aa, 0xaa1133, 0x114422, 0x331144];

        nebulaColors.forEach((color, i) => {
            const angle  = (i / nebulaColors.length) * Math.PI * 2;
            const nebMat = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity:     0.06,
                blending:    THREE.AdditiveBlending,
                depthWrite:  false,
                side:        THREE.DoubleSide,
            });
            const neb = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), nebMat);
            neb.position.set(Math.cos(angle) * 10, 0, Math.sin(angle) * 10);
            neb.rotation.y = angle;
            neb.rotation.x = (Math.random() - 0.5) * 0.5;
            scene.add(neb);
        });

        // ─────────────────────────────────────────
        // 7. CONTRÔLES UI
        // ─────────────────────────────────────────
        const controlsHTML = `
            <div id="bloomControls" style="
                display:flex; gap:12px; align-items:center;
                margin-top:14px; background:rgba(0,0,10,0.95);
                padding:10px 20px; border-radius:30px;
                flex-wrap:wrap; justify-content:center;
                font-family:sans-serif;
            ">
                <label style="color:#8899ff;font-size:13px;">Bloom</label>
                <input type="range" id="bloomStrength" min="0" max="4" value="1.5" step="0.1"
                    style="width:80px; accent-color:#5555ff;">
                <span id="bloomStrengthVal" style="color:#fff;font-size:13px;min-width:20px;">1.5</span>

                <label style="color:#8899ff;font-size:13px;">Rayon</label>
                <input type="range" id="bloomRadius" min="0" max="1.5" value="0.4" step="0.05"
                    style="width:80px; accent-color:#5555ff;">
                <span id="bloomRadiusVal" style="color:#fff;font-size:13px;min-width:20px;">0.4</span>

                <label style="color:#8899ff;font-size:13px;">Aberration</label>
                <input type="range" id="chromaStr" min="0" max="0.02" value="0.003" step="0.001"
                    style="width:80px; accent-color:#ff5588;">
                <span id="chromaStrVal" style="color:#fff;font-size:13px;min-width:30px;">0.003</span>

                <label style="color:#8899ff;font-size:13px;">Vitesse</label>
                <input type="range" id="galaxySpeed" min="0" max="3" value="1" step="0.1"
                    style="width:80px; accent-color:#5555ff;">

                <button id="bloomPauseBtn" style="
                    color:#fff; background:rgba(80,80,200,0.3);
                    border:1px solid rgba(80,80,255,0.5);
                    padding:5px 14px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⏸ Pause</button>
            </div>
        `;

        canvas.insertAdjacentHTML('afterend', controlsHTML);

        let galaxySpeed = 1;
        let running     = true;

        document.getElementById('bloomStrength').addEventListener('input', e => {
            bloomPass.strength = +e.target.value;
            document.getElementById('bloomStrengthVal').textContent = e.target.value;
        });
        document.getElementById('bloomRadius').addEventListener('input', e => {
            bloomPass.radius = +e.target.value;
            document.getElementById('bloomRadiusVal').textContent = e.target.value;
        });
        document.getElementById('chromaStr').addEventListener('input', e => {
            chromaPass.uniforms.uStrength.value = +e.target.value;
            document.getElementById('chromaStrVal').textContent = e.target.value;
        });
        document.getElementById('galaxySpeed').addEventListener('input', e => {
            galaxySpeed = +e.target.value;
        });
        document.getElementById('bloomPauseBtn').addEventListener('click', () => {
            running = !running;
            document.getElementById('bloomPauseBtn').textContent =
                running ? '⏸ Pause' : '▶ Play';
        });

        // ─────────────────────────────────────────
        // 8. INTERACTION SOURIS — zoom + tilt
        // ─────────────────────────────────────────
        let mouseX = 0, mouseY = 0;
        let targetZ = 40;

        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            mouseX = ((e.clientX - rect.left) / W - 0.5) * 2;
            mouseY = ((e.clientY - rect.top)  / H - 0.5) * 2;
        });

        canvas.addEventListener('wheel', e => {
            targetZ = Math.max(15, Math.min(80, targetZ + e.deltaY * 0.05));
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
            elapsed     += delta * galaxySpeed;

            // Update uniforms des bras
            arms.forEach(({ mat }) => {
                mat.uniforms.uTime.value = elapsed;
            });

            // Pulsation du noyau
            const pulse = 1 + Math.sin(elapsed * 2) * 0.1;
            core.scale.setScalar(pulse);

            // Caméra — suit la souris + zoom molette
            camera.position.x += (mouseX * 8 - camera.position.x) * 0.03;
            camera.position.y += (-mouseY * 5 - camera.position.y) * 0.03;
            camera.position.z += (targetZ - camera.position.z) * 0.05;
            camera.lookAt(0, 0, 0);

            // Rotation légère de la caméra autour de Y
            const camAngle = elapsed * 0.03;
            camera.position.x += Math.cos(camAngle) * 0.1;
            camera.position.z += Math.sin(camAngle) * 0.1;

            // Update chroma
            chromaPass.uniforms.uTime.value = elapsed;

            // Rendu via le composer (post-processing)
            composer.render();   // ← PAS renderer.render() !
        }

        animate();
    }
}