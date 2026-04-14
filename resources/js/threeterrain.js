import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

export function init() {
        
    const canvas = document.getElementById("terrainCanvas");

    if (!canvas) {
        console.error("Canvas terrainCanvas introuvable");
    } else {
        const W = canvas.width;
        const H = canvas.height;

        // ─────────────────────────────────────────
        // 1. SETUP
        // ─────────────────────────────────────────
        const scene    = new THREE.Scene();
        const camera   = new THREE.PerspectiveCamera(70, W / H, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

        renderer.setSize(W, H);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type    = THREE.PCFShadowMap;
        renderer.setClearColor(0x1a2a3a, 1);

        camera.position.set(0, 30, 60);
        camera.lookAt(0, 0, 0);

        // ─────────────────────────────────────────
        // 2. BROUILLARD — masque les bords du terrain
        // ─────────────────────────────────────────
        scene.fog = new THREE.Fog(0x1a2a3a, 80, 200);

        // ─────────────────────────────────────────
        // 3. LUMIÈRES
        // ─────────────────────────────────────────
        scene.add(new THREE.AmbientLight(0x334455, 2));

        // Soleil
        const sunLight = new THREE.DirectionalLight(0xffeedd, 2.5);
        sunLight.position.set(50, 80, 30);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width  = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near    = 1;
        sunLight.shadow.camera.far     = 300;
        sunLight.shadow.camera.left    = -100;
        sunLight.shadow.camera.right   = 100;
        sunLight.shadow.camera.top     = 100;
        sunLight.shadow.camera.bottom  = -100;
        scene.add(sunLight);

        // Lumière de lune — bleutée depuis l'opposé
        const moonLight = new THREE.DirectionalLight(0x334488, 0.8);
        moonLight.position.set(-50, 40, -30);
        scene.add(moonLight);

        // ─────────────────────────────────────────
        // 4. TERRAIN PROCÉDURAL — bruit de Simplex
        // ─────────────────────────────────────────
        const simplex   = new SimplexNoise();
        const SIZE      = 200;    // taille du terrain
        const SEGMENTS  = 150;    // subdivisions
        const MAX_HEIGHT = 20;    // hauteur max des pics

        const terrainGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
        terrainGeo.rotateX(-Math.PI / 2);

        // Tableau pour stocker les hauteurs (réutilisé pour l'animation)
        const baseHeights = new Float32Array(terrainGeo.attributes.position.count);

        function generateTerrain(offsetX = 0, offsetZ = 0) {
            const pos = terrainGeo.attributes.position;

            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const z = pos.getZ(i);

                // Superposition de plusieurs octaves de bruit
                // → résultat naturel avec détails fins et formes larges
                const nx = (x + offsetX) / SIZE;
                const nz = (z + offsetZ) / SIZE;

                const height =
                    simplex.noise(nx * 2,   nz * 2)   * MAX_HEIGHT       // grandes collines
                + simplex.noise(nx * 5,   nz * 5)   * MAX_HEIGHT * 0.4  // collines moyennes
                + simplex.noise(nx * 10,  nz * 10)  * MAX_HEIGHT * 0.15 // détails
                + simplex.noise(nx * 20,  nz * 20)  * MAX_HEIGHT * 0.05; // micro détails

                baseHeights[i] = height;
                pos.setY(i, height);
            }

            terrainGeo.attributes.position.needsUpdate = true;
            terrainGeo.computeVertexNormals();
        }

        generateTerrain();

        // ─────────────────────────────────────────
        // 5. MATÉRIAU — couleur selon altitude
        // ─────────────────────────────────────────
        const terrainMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime:       { value: 0 },
                uMaxHeight:  { value: MAX_HEIGHT },
                uFogColor:   { value: new THREE.Color(0x1a2a3a) },
                uFogNear:    { value: 80 },
                uFogFar:     { value: 200 },
            },
            vertexShader: `
                uniform float uTime;
                varying float vHeight;
                varying vec3  vNormal;
                varying vec3  vWorldPos;

                void main() {
                    vHeight   = position.y;
                    vNormal   = normalize(normalMatrix * normal);
                    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uMaxHeight;
                uniform vec3  uFogColor;
                uniform float uFogNear;
                uniform float uFogFar;
                uniform float uTime;

                varying float vHeight;
                varying vec3  vNormal;
                varying vec3  vWorldPos;

                void main() {
                    // Zones de couleur selon l'altitude
                    float h = vHeight / uMaxHeight;  // 0→1

                    vec3 colorWater = vec3(0.05, 0.15, 0.35);  // eau profonde
                    vec3 colorSand  = vec3(0.70, 0.65, 0.45);  // plage
                    vec3 colorGrass = vec3(0.15, 0.45, 0.15);  // prairie
                    vec3 colorRock  = vec3(0.40, 0.35, 0.30);  // rocher
                    vec3 colorSnow  = vec3(0.90, 0.92, 0.95);  // neige

                    vec3 terrainColor;
                    if (h < -0.1) {
                        terrainColor = colorWater;
                    } else if (h < 0.05) {
                        terrainColor = mix(colorWater, colorSand, (h + 0.1) / 0.15);
                    } else if (h < 0.25) {
                        terrainColor = mix(colorSand, colorGrass, (h - 0.05) / 0.2);
                    } else if (h < 0.6) {
                        terrainColor = mix(colorGrass, colorRock, (h - 0.25) / 0.35);
                    } else {
                        terrainColor = mix(colorRock, colorSnow, (h - 0.6) / 0.4);
                    }

                    // Éclairage diffus simple
                    vec3  lightDir = normalize(vec3(50.0, 80.0, 30.0));
                    float diff     = max(dot(vNormal, lightDir), 0.0);
                    terrainColor  *= 0.4 + diff * 0.8;

                    // Ombres portées simulées dans les vallées
                    float shadow = smoothstep(-0.3, 0.1, h);
                    terrainColor *= 0.6 + shadow * 0.4;

                    // Brouillard manuel (pour correspondre au fog de Three.js)
                    float depth    = gl_FragCoord.z / gl_FragCoord.w;
                    float fogFactor = clamp((depth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
                    terrainColor   = mix(terrainColor, uFogColor, fogFactor);

                    gl_FragColor = vec4(terrainColor, 1.0);
                }
            `,
        });

        const terrain = new THREE.Mesh(terrainGeo, terrainMat);
        terrain.receiveShadow = true;
        terrain.castShadow    = true;
        scene.add(terrain);

        // ─────────────────────────────────────────
        // 6. EAU — plan semi-transparent
        // ─────────────────────────────────────────
        const waterGeo = new THREE.PlaneGeometry(SIZE, SIZE, 1, 1);
        waterGeo.rotateX(-Math.PI / 2);

        const waterMat = new THREE.ShaderMaterial({
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
                    // Ondulation de surface
                    float wave = sin(vUv.x * 20.0 + uTime * 1.5) *
                                cos(vUv.y * 15.0 + uTime * 1.2) * 0.03;

                    vec3 waterColor = vec3(0.05 + wave, 0.2 + wave, 0.5);

                    // Reflet spéculaire simple
                    float spec = pow(abs(sin(vUv.x * 50.0 + uTime * 3.0) *
                                        cos(vUv.y * 40.0 + uTime * 2.5)), 8.0) * 0.3;
                    waterColor += vec3(spec);

                    gl_FragColor = vec4(waterColor, 0.75);
                }
            `,
            transparent: true,
            depthWrite:  false,
            blending:    THREE.NormalBlending,
            side:        THREE.DoubleSide,
        });

        const water = new THREE.Mesh(waterGeo, waterMat);
        water.position.y = -2;   // niveau de la mer
        scene.add(water);

        // ─────────────────────────────────────────
        // 7. CIEL — dégradé via ShaderMaterial sur sphère
        // ─────────────────────────────────────────
        const skyGeo = new THREE.SphereGeometry(400, 32, 32);
        const skyMat = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            uniforms: {
                uTime:    { value: 0 },
                uDayCycle: { value: 0.5 },
            },
            vertexShader: `
                varying vec3 vPos;
                void main() {
                    vPos = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform float uDayCycle;
                varying vec3  vPos;

                void main() {
                    float h = normalize(vPos).y;

                    // Couleurs jour
                    vec3 dayTop    = vec3(0.15, 0.35, 0.75);
                    vec3 dayBot    = vec3(0.55, 0.75, 0.95);

                    // Couleurs nuit
                    vec3 nightTop  = vec3(0.01, 0.01, 0.08);
                    vec3 nightBot  = vec3(0.05, 0.05, 0.15);

                    vec3 dayColor   = mix(dayBot,   dayTop,   clamp(h, 0.0, 1.0));
                    vec3 nightColor = mix(nightBot, nightTop, clamp(h, 0.0, 1.0));

                    vec3 skyColor = mix(nightColor, dayColor, uDayCycle);

                    // Étoiles la nuit
                    float starNoise = fract(sin(dot(floor(vPos.xy * 100.0),
                        vec2(127.1, 311.7))) * 43758.5);
                    float star = step(0.997, starNoise) * (1.0 - uDayCycle);
                    skyColor += vec3(star);

                    gl_FragColor = vec4(skyColor, 1.0);
                }
            `,
        });

        const sky = new THREE.Mesh(skyGeo, skyMat);
        scene.add(sky);

        // ─────────────────────────────────────────
        // 8. ARBRES — cônes simples sur les zones de prairie
        // ─────────────────────────────────────────
        function addTrees() {
            const treeGroup = new THREE.Group();
            const trunkMat  = new THREE.MeshPhongMaterial({ color: 0x5c3a1e });
            const leafMat   = new THREE.MeshPhongMaterial({ color: 0x1a5c1a });

            const pos = terrainGeo.attributes.position;

            let count = 0;
            for (let i = 0; i < pos.count && count < 200; i += 10) {
                const y = pos.getY(i);
                const h = y / MAX_HEIGHT;

                // Arbres seulement en zone herbe (0.05 → 0.35)
                if (h > 0.05 && h < 0.35 && Math.random() > 0.4) {
                    const x = pos.getX(i);
                    const z = pos.getZ(i);

                    const height = 1.5 + Math.random() * 2;

                    // Tronc
                    const trunk = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.1, 0.15, height * 0.4, 5),
                        trunkMat
                    );

                    // Feuillage — empilement de cônes
                    const leaves1 = new THREE.Mesh(
                        new THREE.ConeGeometry(height * 0.5, height, 6),
                        leafMat
                    );
                    const leaves2 = new THREE.Mesh(
                        new THREE.ConeGeometry(height * 0.35, height * 0.8, 6),
                        leafMat
                    );
                    const leaves3 = new THREE.Mesh(
                        new THREE.ConeGeometry(height * 0.2, height * 0.6, 6),
                        leafMat
                    );

                    trunk.position.y   = height * 0.2;
                    leaves1.position.y = height * 0.6;
                    leaves2.position.y = height * 0.9;
                    leaves3.position.y = height * 1.15;

                    trunk.castShadow   = true;
                    leaves1.castShadow = true;

                    const tree = new THREE.Group();
                    tree.add(trunk, leaves1, leaves2, leaves3);
                    tree.position.set(x, y, z);
                    tree.rotation.y = Math.random() * Math.PI * 2;

                    treeGroup.add(tree);
                    count++;
                }
            }

            scene.add(treeGroup);
        }

        addTrees();

        // ─────────────────────────────────────────
        // 9. CONTRÔLES UI
        // ─────────────────────────────────────────
        const controlsHTML = `
            <div id="terrainControls" style="
                display:flex; gap:12px; align-items:center;
                margin-top:14px; background:rgba(10,20,30,0.9);
                padding:10px 20px; border-radius:30px;
                flex-wrap:wrap; justify-content:center;
                font-family:sans-serif;
            ">
                <label style="color:#88aacc;font-size:13px;">Survol</label>
                <input type="range" id="flySpeed" min="0" max="5" value="1" step="0.1"
                    style="width:90px; accent-color:#336699;">
                <span id="flySpeedVal" style="color:#fff;font-size:13px;min-width:20px;">1</span>

                <label style="color:#88aacc;font-size:13px;">Hauteur</label>
                <input type="range" id="flyHeight" min="5" max="80" value="30" step="1"
                    style="width:90px; accent-color:#336699;">
                <span id="flyHeightVal" style="color:#fff;font-size:13px;min-width:20px;">30</span>

                <label style="color:#88aacc;font-size:13px;">Cycle jour</label>
                <input type="range" id="dayCycle" min="0" max="1" value="0.5" step="0.01"
                    style="width:90px; accent-color:#ffaa33;">
                <span id="dayCycleVal" style="color:#fff;font-size:13px;min-width:30px;">Jour</span>

                <button id="terrainRegenBtn" style="
                    color:#fff; background:rgba(50,150,80,0.3);
                    border:1px solid rgba(50,200,80,0.5);
                    padding:5px 14px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⟳ Nouveau terrain</button>

                <button id="terrainPauseBtn" style="
                    color:#fff; background:rgba(100,100,200,0.3);
                    border:1px solid rgba(100,100,255,0.4);
                    padding:5px 14px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⏸ Pause</button>
            </div>
        `;

        canvas.insertAdjacentHTML('afterend', controlsHTML);

        let flySpeed  = 1;
        let flyHeight = 30;
        let running   = true;
        let dayCycle  = 0.5;
        let terrainOffset = 0;

        document.getElementById('flySpeed').addEventListener('input', e => {
            flySpeed = +e.target.value;
            document.getElementById('flySpeedVal').textContent = e.target.value;
        });

        document.getElementById('flyHeight').addEventListener('input', e => {
            flyHeight = +e.target.value;
            document.getElementById('flyHeightVal').textContent = e.target.value;
        });

        document.getElementById('dayCycle').addEventListener('input', e => {
            dayCycle = +e.target.value;
            const label = dayCycle < 0.3 ? 'Nuit' : dayCycle < 0.6 ? 'Jour' : 'Coucher';
            document.getElementById('dayCycleVal').textContent = label;

            // Adapte les lumières au cycle jour/nuit
            sunLight.intensity  = dayCycle * 3;
            moonLight.intensity = (1 - dayCycle) * 1.5;
            renderer.setClearColor(
                new THREE.Color().setHSL(0.6, 0.3, 0.05 + dayCycle * 0.2), 1
            );
            scene.fog.color.setHSL(0.6, 0.3, 0.05 + dayCycle * 0.2);
        });

        document.getElementById('terrainRegenBtn').addEventListener('click', () => {
            terrainOffset = Math.random() * 1000;
            generateTerrain(terrainOffset, terrainOffset);
            scene.remove(scene.getObjectByName('treeGroup'));
            addTrees();
        });

        document.getElementById('terrainPauseBtn').addEventListener('click', () => {
            running = !running;
            document.getElementById('terrainPauseBtn').textContent =
                running ? '⏸ Pause' : '▶ Play';
        });

        // ─────────────────────────────────────────
        // 10. ANIMATION — survol du terrain
        // ─────────────────────────────────────────
        const timer   = new THREE.Timer();
        let   elapsed = 0;
        let   camAngle = 0;

        function animate() {
            requestAnimationFrame(animate);
            if (!running) return;

            timer.update();
            const delta  = timer.getDelta();
            elapsed     += delta;
            camAngle    += delta * flySpeed * 0.15;

            // Caméra orbite autour du terrain
            const radius = 70;
            camera.position.x = Math.cos(camAngle) * radius;
            camera.position.z = Math.sin(camAngle) * radius;
            camera.position.y = flyHeight + Math.sin(elapsed * 0.3) * 5;
            camera.lookAt(0, 5, 0);

            // Update uniforms
            terrainMat.uniforms.uTime.value  = elapsed;
            waterMat.uniforms.uTime.value    = elapsed;
            skyMat.uniforms.uTime.value      = elapsed;
            skyMat.uniforms.uDayCycle.value  = dayCycle;

            // Cycle jour/nuit automatique lent
            if (flySpeed > 0) {
                dayCycle = (Math.sin(elapsed * 0.05) + 1) / 2;
                document.getElementById('dayCycle').value = dayCycle;
                sunLight.intensity  = dayCycle * 3;
                moonLight.intensity = (1 - dayCycle) * 1.5;
            }

            renderer.render(scene, camera);
        }

        animate();
    }
}