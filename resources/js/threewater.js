import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export function init() {

    (function initWater() {
        const canvas = document.getElementById("waterCanvas");
        if (!canvas) { console.error("Canvas waterCanvas introuvable"); return; }

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
        renderer.setClearColor(0x000a14, 1);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type    = THREE.PCFShadowMap;

        camera.position.set(0, 12, 25);
        camera.lookAt(0, 0, 0);

        // ─────────────────────────────────────────
        // 2. POST-PROCESSING
        // ─────────────────────────────────────────
        const composer  = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new UnrealBloomPass(
            new THREE.Vector2(W, H),
            0.8,    // strength
            0.4,    // radius
            0.7     // threshold
        ));

        // ─────────────────────────────────────────
        // 3. LUMIÈRES
        // ─────────────────────────────────────────
        scene.add(new THREE.AmbientLight(0x112233, 2));

        // Lumière principale — bleue froide
        const mainLight = new THREE.DirectionalLight(0x4488ff, 2);
        mainLight.position.set(10, 20, 10);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width  = 1024;
        mainLight.shadow.mapSize.height = 1024;
        scene.add(mainLight);

        // Lumières colorées dynamiques — reflétées dans l'eau
        const lights = [
            { light: new THREE.PointLight(0xff4488, 3, 30), angle: 0,              radius: 12 },
            { light: new THREE.PointLight(0x44ffaa, 3, 30), angle: Math.PI * 0.66, radius: 12 },
            { light: new THREE.PointLight(0x8844ff, 3, 30), angle: Math.PI * 1.33, radius: 12 },
        ];

        lights.forEach(({ light }) => {
            light.position.y = 5;
            scene.add(light);
        });

        // ─────────────────────────────────────────
        // 4. PLAN D'EAU — ShaderMaterial réflectif
        // ─────────────────────────────────────────
        const waterGeo = new THREE.PlaneGeometry(40, 40, 128, 128);
        waterGeo.rotateX(-Math.PI / 2);

        const waterMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime:       { value: 0 },
                uLight1Pos:  { value: new THREE.Vector3() },
                uLight2Pos:  { value: new THREE.Vector3() },
                uLight3Pos:  { value: new THREE.Vector3() },
                uLight1Col:  { value: new THREE.Color(0xff4488) },
                uLight2Col:  { value: new THREE.Color(0x44ffaa) },
                uLight3Col:  { value: new THREE.Color(0x8844ff) },
                uCamPos:     { value: camera.position },
            },
            vertexShader: `
                uniform float uTime;
                varying vec3  vWorldPos;
                varying vec3  vNormal;
                varying vec2  vUv;

                void main() {
                    vUv = uv;
                    vec3 pos = position;

                    // Vagues superposées — même principe que l'océan
                    float w1 = sin(pos.x * 0.4 + uTime * 1.5) *
                            cos(pos.z * 0.3 + uTime * 1.2) * 0.4;
                    float w2 = sin(pos.x * 0.8 - uTime * 1.0) *
                            sin(pos.z * 0.6 + uTime * 0.8) * 0.2;
                    float w3 = cos(pos.x * 1.5 + uTime * 2.0) *
                            cos(pos.z * 1.2 - uTime * 1.8) * 0.08;

                    pos.y += w1 + w2 + w3;

                    // Normale approximée pour les reflets
                    float eps = 0.1;
                    float hL  = sin((pos.x - eps) * 0.4 + uTime * 1.5) * 0.4;
                    float hR  = sin((pos.x + eps) * 0.4 + uTime * 1.5) * 0.4;
                    float hD  = cos((pos.z - eps) * 0.3 + uTime * 1.2) * 0.4;
                    float hU  = cos((pos.z + eps) * 0.3 + uTime * 1.2) * 0.4;
                    vNormal   = normalize(vec3(hL - hR, 2.0, hD - hU));

                    vWorldPos   = (modelMatrix * vec4(pos, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform vec3  uLight1Pos;
                uniform vec3  uLight2Pos;
                uniform vec3  uLight3Pos;
                uniform vec3  uLight1Col;
                uniform vec3  uLight2Col;
                uniform vec3  uLight3Col;
                uniform vec3  uCamPos;

                varying vec3 vWorldPos;
                varying vec3 vNormal;
                varying vec2 vUv;

                // Reflet spéculaire d'une lumière ponctuelle
                vec3 pointSpecular(vec3 lightPos, vec3 lightCol, vec3 normal,
                                vec3 viewDir, float shininess) {
                    vec3  lightDir = normalize(lightPos - vWorldPos);
                    vec3  halfDir  = normalize(lightDir + viewDir);
                    float spec     = pow(max(dot(normal, halfDir), 0.0), shininess);
                    float dist     = length(lightPos - vWorldPos);
                    float atten    = 1.0 / (1.0 + dist * dist * 0.02);
                    return lightCol * spec * atten;
                }

                void main() {
                    vec3 viewDir = normalize(uCamPos - vWorldPos);
                    vec3 normal  = normalize(vNormal);

                    // Couleur de base — eau sombre avec nuance de profondeur
                    float depth   = 1.0 - abs(vWorldPos.y) * 0.3;
                    vec3  baseCol = vec3(0.01, 0.05, 0.12) * depth;

                    // Reflets spéculaires des 3 lumières colorées
                    float shine = 80.0;
                    vec3 spec1  = pointSpecular(uLight1Pos, uLight1Col, normal, viewDir, shine);
                    vec3 spec2  = pointSpecular(uLight2Pos, uLight2Col, normal, viewDir, shine);
                    vec3 spec3  = pointSpecular(uLight3Pos, uLight3Col, normal, viewDir, shine);

                    // Fresnel — plus réfléchissant sur les bords (vue rasante)
                    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
                    vec3  fresnelCol = (spec1 + spec2 + spec3) * fresnel * 2.0;

                    // Reflets diffus dans l'eau
                    vec3 diffuse = (uLight1Col * 0.1 + uLight2Col * 0.1 + uLight3Col * 0.1)
                                * (0.5 + dot(normal, vec3(0,1,0)) * 0.5);

                    // Scintillement — petites étincelles aléatoires
                    float spark = sin(vUv.x * 100.0 + uTime * 5.0) *
                                cos(vUv.y * 80.0  + uTime * 4.0);
                    spark = pow(max(spark, 0.0), 12.0) * 0.5;

                    vec3 finalCol = baseCol + spec1 + spec2 + spec3
                                + fresnelCol + diffuse
                                + vec3(spark);

                    gl_FragColor = vec4(finalCol, 0.88);
                }
            `,
            transparent: true,
            side:        THREE.DoubleSide,
            depthWrite:  false,
        });

        const water = new THREE.Mesh(waterGeo, waterMat);
        scene.add(water);

        // ─────────────────────────────────────────
        // 5. OBJETS AU-DESSUS DE L'EAU
        // Flottent et projettent des reflets
        // ─────────────────────────────────────────
        const objects = [];

        // Sphères lumineuses
        const sphereConfigs = [
            { color: 0xff4488, pos: [-6,  3, -4], size: 0.8 },
            { color: 0x44ffaa, pos: [ 5,  4, -6], size: 1.0 },
            { color: 0x8844ff, pos: [ 0,  5,  4], size: 0.6 },
            { color: 0xffaa00, pos: [-4,  2,  5], size: 0.5 },
            { color: 0x00ccff, pos: [ 7,  3,  2], size: 0.7 },
        ];

        sphereConfigs.forEach(({ color, pos, size }) => {
            // Sphère principale
            const mesh = new THREE.Mesh(
                new THREE.SphereGeometry(size, 16, 16),
                new THREE.MeshBasicMaterial({ color })
            );
            mesh.position.set(...pos);
            mesh.castShadow = true;
            scene.add(mesh);

            // Halo autour de la sphère
            const halo = new THREE.Mesh(
                new THREE.SphereGeometry(size * 1.8, 16, 16),
                new THREE.MeshBasicMaterial({
                    color,
                    transparent: true,
                    opacity:     0.08,
                    blending:    THREE.AdditiveBlending,
                    depthWrite:  false,
                })
            );
            scene.add(halo);

            objects.push({
                mesh, halo,
                baseY:    pos[1],
                phase:    Math.random() * Math.PI * 2,
                floatAmp: 0.3 + Math.random() * 0.4,
                floatSpd: 0.5 + Math.random() * 0.5,
            });
        });

        // Anneaux décoratifs
        const ringConfigs = [
            { color: 0xff4488, pos: [0, 0.5, 0],  radius: 8,  tube: 0.05 },
            { color: 0x44ffaa, pos: [0, 0.8, 0],  radius: 12, tube: 0.03 },
            { color: 0x8844ff, pos: [0, 0.3, 0],  radius: 5,  tube: 0.04 },
        ];

        const rings = [];
        ringConfigs.forEach(({ color, pos, radius, tube }) => {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(radius, tube, 8, 64),
                new THREE.MeshBasicMaterial({
                    color,
                    transparent: true,
                    opacity:     0.5,
                    blending:    THREE.AdditiveBlending,
                    depthWrite:  false,
                })
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.set(...pos);
            scene.add(ring);
            rings.push({ mesh: ring, phase: Math.random() * Math.PI * 2 });
        });

        // ─────────────────────────────────────────
        // 6. PARTICULES — poussière lumineuse
        // ─────────────────────────────────────────
        const dustCount = 1500;
        const dustGeo   = new THREE.BufferGeometry();
        const dustPos   = new Float32Array(dustCount * 3);
        const dustPhase = new Float32Array(dustCount);

        for (let i = 0; i < dustCount; i++) {
            dustPos[i * 3]     = (Math.random() - 0.5) * 40;
            dustPos[i * 3 + 1] = Math.random() * 15;
            dustPos[i * 3 + 2] = (Math.random() - 0.5) * 40;
            dustPhase[i]       = Math.random() * Math.PI * 2;
        }

        dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));

        const dustMat = new THREE.PointsMaterial({
            color:       0xaaccff,
            size:        0.06,
            transparent: true,
            opacity:     0.4,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
        });

        const dust = new THREE.Points(dustGeo, dustMat);
        scene.add(dust);

        // ─────────────────────────────────────────
        // 7. CONTRÔLES UI
        // ─────────────────────────────────────────
        const controlsHTML = `
            <div id="waterControls" style="
                display:flex; gap:12px; align-items:center;
                margin-top:14px; background:rgba(0,10,20,0.95);
                padding:10px 20px; border-radius:30px;
                flex-wrap:wrap; justify-content:center;
                font-family:sans-serif;
            ">
                <label style="color:#88aaff;font-size:13px;">Vagues</label>
                <input type="range" id="waveAmp" min="0" max="3" value="1" step="0.1"
                    style="width:80px; accent-color:#4488ff;">
                <span id="waveAmpVal" style="color:#fff;font-size:13px;min-width:20px;">1</span>

                <label style="color:#88aaff;font-size:13px;">Bloom</label>
                <input type="range" id="waterBloom" min="0" max="3" value="0.8" step="0.1"
                    style="width:80px; accent-color:#4488ff;">
                <span id="waterBloomVal" style="color:#fff;font-size:13px;min-width:20px;">0.8</span>

                <label style="color:#88aaff;font-size:13px;">Vitesse</label>
                <input type="range" id="waterSpeed" min="0" max="3" value="1" step="0.1"
                    style="width:80px; accent-color:#4488ff;">

                <button id="waterPauseBtn" style="
                    color:#fff; background:rgba(0,80,160,0.4);
                    border:1px solid rgba(0,150,255,0.5);
                    padding:5px 14px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⏸ Pause</button>
            </div>
        `;

        canvas.insertAdjacentHTML('afterend', controlsHTML);

        let waveAmp   = 1;
        let waterSpd  = 1;
        let running   = true;
        let bloomPass;

        // Récupère le bloomPass depuis le composer
        bloomPass = composer.passes[1];

        document.getElementById('waveAmp').addEventListener('input', e => {
            waveAmp = +e.target.value;
            document.getElementById('waveAmpVal').textContent = e.target.value;
        });
        document.getElementById('waterBloom').addEventListener('input', e => {
            bloomPass.strength = +e.target.value;
            document.getElementById('waterBloomVal').textContent = e.target.value;
        });
        document.getElementById('waterSpeed').addEventListener('input', e => {
            waterSpd = +e.target.value;
        });
        document.getElementById('waterPauseBtn').addEventListener('click', () => {
            running = !running;
            document.getElementById('waterPauseBtn').textContent =
                running ? '⏸ Pause' : '▶ Play';
        });

        // ─────────────────────────────────────────
        // 8. INTERACTION SOURIS
        // ─────────────────────────────────────────
        let mouseX = 0, mouseY = 0;

        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            mouseX = ((e.clientX - rect.left) / W - 0.5) * 2;
            mouseY = ((e.clientY - rect.top)  / H - 0.5) * 2;
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
            elapsed     += delta * waterSpd;

            // Update uniforms eau
            waterMat.uniforms.uTime.value = elapsed * waveAmp;

            // Rotation des lumières colorées
            lights.forEach(({ light, angle, radius }, i) => {
                const a = angle + elapsed * (0.4 + i * 0.1);
                light.position.x = Math.cos(a) * radius;
                light.position.z = Math.sin(a) * radius;
                light.position.y = 4 + Math.sin(elapsed * 0.7 + i) * 1.5;
            });

            // Sync positions lumières → uniforms shader eau
            waterMat.uniforms.uLight1Pos.value.copy(lights[0].light.position);
            waterMat.uniforms.uLight2Pos.value.copy(lights[1].light.position);
            waterMat.uniforms.uLight3Pos.value.copy(lights[2].light.position);

            // Flottement des sphères
            objects.forEach(({ mesh, halo, baseY, phase, floatAmp, floatSpd }) => {
                const y = baseY + Math.sin(elapsed * floatSpd + phase) * floatAmp;
                mesh.position.y = y;
                halo.position.copy(mesh.position);
                mesh.rotation.y += 0.005;
            });

            // Rotation des anneaux
            rings.forEach(({ mesh, phase }, i) => {
                mesh.rotation.z = elapsed * 0.2 * (i % 2 === 0 ? 1 : -1) + phase;
                mesh.position.y = 0.3 + Math.sin(elapsed * 0.4 + phase) * 0.3;
            });

            // Dérive des particules
            const dp = dustGeo.attributes.position.array;
            for (let i = 0; i < dustCount; i++) {
                dustPhase[i] += delta * 0.2;
                dp[i * 3]     += Math.sin(dustPhase[i] + i) * 0.003;
                dp[i * 3 + 1] += 0.005;
                dp[i * 3 + 2] += Math.cos(dustPhase[i] + i) * 0.003;
                // Recycler si trop haut
                if (dp[i * 3 + 1] > 15) {
                    dp[i * 3 + 1] = 0;
                }
            }
            dustGeo.attributes.position.needsUpdate = true;

            // Caméra — suit la souris + orbite lente
            const orbitAngle = elapsed * 0.08;
            camera.position.x += (mouseX * 5  + Math.cos(orbitAngle) * 2 - camera.position.x) * 0.02;
            camera.position.y += (-mouseY * 3 + 12 - camera.position.y) * 0.02;
            camera.position.z += (Math.sin(orbitAngle) * 2 + 25 - camera.position.z) * 0.02;
            camera.lookAt(0, 2, 0);

            composer.render();
        }

        animate();
    })();
}