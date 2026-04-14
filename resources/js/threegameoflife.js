import * as THREE from 'three';

export function init() {

    (function initGameOfLife() {
        const canvas = document.getElementById("gameOfLifeCanvas");
        if (!canvas) { console.error("Canvas gameOfLifeCanvas introuvable"); return; }

    
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
        renderer.setClearColor(0x000022, 1);

        camera.position.set(0, 0, 80);
        camera.lookAt(0, 0, 0);


        // Test de rendu initial pour vérifier que tout est opérationnel
        renderer.render(scene, camera);


        // ─────────────────────────────────────────
        // 2. GRILLE — paramètres
        // ─────────────────────────────────────────
        const COLS      = 80;
        const ROWS      = 55;
        const CELL_SIZE = 1.4;
        const GAP       = 0.15;
        const STEP      = CELL_SIZE + GAP;

        // Offset pour centrer la grille
        const offsetX = -(COLS * STEP) / 2 + STEP / 2;
        const offsetY = -(ROWS * STEP) / 2 + STEP / 2;

        // ─────────────────────────────────────────
        // 3. ÉTAT — deux grilles pour double buffer
        // On alterne entre current et next
        // pour éviter de lire/écrire la même grille
        // ─────────────────────────────────────────
        let current = new Uint8Array(COLS * ROWS);
        let next    = new Uint8Array(COLS * ROWS);

        // Age de chaque cellule — pour la couleur
        const age = new Float32Array(COLS * ROWS);

        function idx(col, row) {
            return row * COLS + col;
        }

        // Init aléatoire — ~35% de cellules vivantes
        function randomize() {
            for (let i = 0; i < COLS * ROWS; i++) {
                current[i] = Math.random() < 0.35 ? 1 : 0;
                age[i]     = current[i] ? Math.random() * 5 : 0;
            }
        }

        // Patterns célèbres
        const PATTERNS = {
            glider: [
                [1, 0], [2, 1], [0, 2], [1, 2], [2, 2]
            ],
            pulsar: [
                // Pulsar — oscillateur période 3
                [2,0],[3,0],[4,0],[8,0],[9,0],[10,0],
                [0,2],[5,2],[7,2],[12,2],
                [0,3],[5,3],[7,3],[12,3],
                [0,4],[5,4],[7,4],[12,4],
                [2,5],[3,5],[4,5],[8,5],[9,5],[10,5],
                [2,7],[3,7],[4,7],[8,7],[9,7],[10,7],
                [0,8],[5,8],[7,8],[12,8],
                [0,9],[5,9],[7,9],[12,9],
                [0,10],[5,10],[7,10],[12,10],
                [2,12],[3,12],[4,12],[8,12],[9,12],[10,12],
            ],
            gosper: [
                // Gosper Glider Gun — génère des gliders en continu
                [0,4],[0,5],[1,4],[1,5],
                [10,4],[10,5],[10,6],[11,3],[11,7],[12,2],[12,8],
                [13,2],[13,8],[14,5],[15,3],[15,7],[16,4],[16,5],
                [16,6],[17,5],[20,2],[20,3],[20,4],[21,2],[21,3],
                [21,4],[22,1],[22,5],[24,0],[24,1],[24,5],[24,6],
                [34,2],[34,3],[35,2],[35,3],
            ],
        };

        function placePattern(pattern, startCol, startRow) {
            current.fill(0);
            age.fill(0);
            pattern.forEach(([dc, dr]) => {
                const c = startCol + dc;
                const r = startRow + dr;
                if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
                    current[idx(c, r)] = 1;
                    age[idx(c, r)]     = 0;
                }
            });
        }

        randomize();

        // ─────────────────────────────────────────
        // 4. RÈGLES DU JEU DE LA VIE
        // ─────────────────────────────────────────
        function countNeighbors(col, row) {
            let count = 0;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    // Bordures toriques — la grille se "wrap"
                    const nc = (col + dc + COLS) % COLS;
                    const nr = (row + dr + ROWS) % ROWS;
                    count += current[idx(nc, nr)];
                }
            }
            return count;
        }

        function stepSimulation() {
            for (let row = 0; row < ROWS; row++) {
                for (let col = 0; col < COLS; col++) {
                    const i         = idx(col, row);
                    const neighbors = countNeighbors(col, row);
                    const alive     = current[i] === 1;

                    if (alive) {
                        // Survit avec 2 ou 3 voisins
                        next[i] = (neighbors === 2 || neighbors === 3) ? 1 : 0;
                    } else {
                        // Naît avec exactement 3 voisins
                        next[i] = neighbors === 3 ? 1 : 0;
                    }

                    // Âge — les cellules vieillissent
                    if (next[i] === 1) {
                        age[i] = alive ? age[i] + 0.1 : 0;
                    } else {
                        age[i] = Math.max(0, age[i] - 0.3);  // fade out
                    }
                }
            }

            // Swap des buffers
            [current, next] = [next, current];
        }

        // ─────────────────────────────────────────
        // 5. RENDU — InstancedMesh pour les cellules
        // Un seul draw call pour toutes les cellules !
        // ─────────────────────────────────────────
        const cellGeo = new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE);
        const cellMat = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent:  true,
            blending:     THREE.AdditiveBlending,
            depthWrite:   false,
        });

        // InstancedMesh — COLS*ROWS instances du même quad
        const instanceCount = COLS * ROWS;
        const mesh          = new THREE.InstancedMesh(cellGeo, cellMat, instanceCount);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(mesh);

        // Couleurs des instances
        const instanceColors = new THREE.InstancedBufferAttribute(
            new Float32Array(instanceCount * 3), 3
        );
        mesh.instanceColor = instanceColors;

        // Matrice de transformation pour chaque cellule
        const dummy = new THREE.Object3D();

        function updateMesh() {
            for (let row = 0; row < ROWS; row++) {
                for (let col = 0; col < COLS; col++) {
                    const i     = idx(col, row);
                    const alive = current[i];
                    const a     = age[i];

                    // Position
                    dummy.position.set(
                        offsetX + col * STEP,
                        offsetY + row * STEP,
                        0
                    );

                    // Scale — les cellules naissantes/mourantes pulsent
                    const scale = alive
                        ? 0.3 + Math.min(a / 3, 0.7)   // grandit avec l'âge
                        : Math.max(0, a) * 0.5;         // rétrécit en mourant

                    dummy.scale.setScalar(scale > 0.01 ? scale : 0.001);
                    dummy.updateMatrix();
                    mesh.setMatrixAt(i, dummy.matrix);

                    // Couleur selon l'âge
                    let r, g, b;
                    if (alive) {
                        const t = Math.min(a / 10, 1);
                        if (t < 0.3) {
                            // Jeune — vert vif
                            r = 0.0; g = 1.0; b = 0.0;
                        } else if (t < 0.6) {
                            // Adulte — jaune vif
                            r = 1.0; g = 1.0; b = 0.0;
                        } else {
                            // Vieille — rouge vif
                            r = 1.0; g = 0.0; b = 0.0;
                        }
                    } else {
                        // Morte — gris clair qui s'efface
                        r = 0.3; g = 0.3; b = 0.3;
                    }

                    instanceColors.setXYZ(i, r * scale, g * scale, b * scale);
                }
            }

            mesh.instanceMatrix.needsUpdate = true;
            instanceColors.needsUpdate      = true;
        }

        // ─────────────────────────────────────────
        // 6. PARTICULES — éclat à la naissance
        // ─────────────────────────────────────────
        const sparkCount = 500;
        const sparkGeo   = new THREE.BufferGeometry();
        const sparkPos   = new Float32Array(sparkCount * 3);
        const sparkVel   = new Float32Array(sparkCount * 3);
        const sparkLife  = new Float32Array(sparkCount);

        sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));

        const sparkMat = new THREE.PointsMaterial({
            color:       0xffff00,
            size:        1.5,
            transparent: true,
            opacity:     0.8,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
        });

        scene.add(new THREE.Points(sparkGeo, sparkMat));

        let sparkIdx = 0;

        function spawnSpark(col, row) {
            const i = sparkIdx % sparkCount;
            sparkPos[i * 3]     = offsetX + col * STEP;
            sparkPos[i * 3 + 1] = offsetY + row * STEP;
            sparkPos[i * 3 + 2] = 0.5;
            sparkVel[i * 3]     = (Math.random() - 0.5) * 0.5;
            sparkVel[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
            sparkVel[i * 3 + 2] = Math.random() * 0.3;
            sparkLife[i]        = 1.0;
            sparkIdx++;
        }

        // ─────────────────────────────────────────
        // 7. CONTRÔLES UI
        // ─────────────────────────────────────────
        const controlsHTML = `
            <div id="golControls" style="
                display:flex; gap:10px; align-items:center;
                margin-top:14px; background:rgba(0,0,15,0.95);
                padding:10px 18px; border-radius:30px;
                flex-wrap:wrap; justify-content:center;
                font-family:sans-serif;
            ">
                <label style="color:#00ffcc;font-size:13px;">Vitesse</label>
                <input type="range" id="golSpeed" min="1" max="30" value="10" step="1"
                    style="width:80px; accent-color:#00ffcc;">
                <span id="golSpeedVal" style="color:#fff;font-size:13px;min-width:20px;">10</span>

                <button class="golPatternBtn" data-pattern="random" style="
                    color:#fff; background:rgba(0,200,150,0.2);
                    border:1px solid rgba(0,200,150,0.5);
                    padding:5px 12px; border-radius:20px;
                    cursor:pointer; font-size:12px;">⟳ Aléatoire</button>

                <button class="golPatternBtn" data-pattern="glider" style="
                    color:#fff; background:rgba(0,150,255,0.2);
                    border:1px solid rgba(0,150,255,0.5);
                    padding:5px 12px; border-radius:20px;
                    cursor:pointer; font-size:12px;">✦ Glider</button>

                <button class="golPatternBtn" data-pattern="pulsar" style="
                    color:#fff; background:rgba(150,0,255,0.2);
                    border:1px solid rgba(150,0,255,0.5);
                    padding:5px 12px; border-radius:20px;
                    cursor:pointer; font-size:12px;">◎ Pulsar</button>

                <button class="golPatternBtn" data-pattern="gosper" style="
                    color:#fff; background:rgba(255,100,0,0.2);
                    border:1px solid rgba(255,100,0,0.5);
                    padding:5px 12px; border-radius:20px;
                    cursor:pointer; font-size:12px;">⚡ Gosper Gun</button>

                <button id="golPauseBtn" style="
                    color:#fff; background:rgba(100,100,200,0.3);
                    border:1px solid rgba(100,100,255,0.4);
                    padding:5px 12px; border-radius:20px;
                    cursor:pointer; font-size:12px;">⏸ Pause</button>

                <span id="golGeneration" style="
                    color:#00ffcc; font-size:12px;
                    font-family:monospace; min-width:80px;">
                    Gen: 0
                </span>
            </div>
        `;

        canvas.insertAdjacentHTML('afterend', controlsHTML);

        let simSpeed  = 10;
        let running   = true;
        let generation = 0;

        document.getElementById('golSpeed').addEventListener('input', e => {
            simSpeed = +e.target.value;
            document.getElementById('golSpeedVal').textContent = e.target.value;
        });

        document.querySelectorAll('.golPatternBtn').forEach(btn => {
            btn.addEventListener('click', () => {
                generation = 0;
                const p = btn.dataset.pattern;
                if (p === 'random') {
                    randomize();
                } else if (p === 'glider') {
                    placePattern(PATTERNS.glider, 5, 5);
                } else if (p === 'pulsar') {
                    placePattern(PATTERNS.pulsar,
                        Math.floor(COLS / 2) - 6,
                        Math.floor(ROWS / 2) - 6
                    );
                } else if (p === 'gosper') {
                    placePattern(PATTERNS.gosper,
                        Math.floor(COLS / 2) - 17,
                        Math.floor(ROWS / 2) - 6
                    );
                }
            });
        });

        document.getElementById('golPauseBtn').addEventListener('click', () => {
            running = !running;
            document.getElementById('golPauseBtn').textContent =
                running ? '⏸ Pause' : '▶ Play';
        });

        // ─────────────────────────────────────────
        // 8. INTERACTION SOURIS — dessiner des cellules
        // ─────────────────────────────────────────
        let isDrawing = false;

        canvas.addEventListener('mousedown', () => { isDrawing = true; });
        canvas.addEventListener('mouseup',   () => { isDrawing = false; });

        canvas.addEventListener('mousemove', e => {
            if (!isDrawing) return;
            const rect = canvas.getBoundingClientRect();
            const mx   = ((e.clientX - rect.left) / W) * 2 - 1;
            const my   = -((e.clientY - rect.top)  / H) * 2 + 1;

            // Convertir coordonnées souris → grille
            const worldX = mx * (COLS * STEP / 2);
            const worldY = my * (ROWS * STEP / 2);
            const col    = Math.round((worldX - offsetX) / STEP);
            const row    = Math.round((worldY - offsetY) / STEP);

            if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
                // Dessine un pineau 3x3
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const nc = col + dc;
                        const nr = row + dr;
                        if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS) {
                            current[idx(nc, nr)] = 1;
                            spawnSpark(nc, nr);
                        }
                    }
                }
            }
        });

        // ─────────────────────────────────────────
        // 9. ANIMATION
        // ─────────────────────────────────────────
        const timer      = new THREE.Timer();
        let   elapsed    = 0;
        let   simElapsed = 0;

        function animate() {
            requestAnimationFrame(animate);

            timer.update();
            const delta  = timer.getDelta();
            elapsed     += delta;

            if (running) {
                simElapsed += delta;

                // Avance la simulation selon la vitesse choisie
                const simInterval = 1 / simSpeed;
                if (simElapsed >= simInterval) {
                    simElapsed = 0;
                    generation++;

                    // Spawn de sparks sur les nouvelles naissances
                    for (let row = 0; row < ROWS; row++) {
                        for (let col = 0; col < COLS; col++) {
                            const i = idx(col, row);
                            if (next[i] === 1 && current[i] === 0) {
                                if (Math.random() < 0.1) spawnSpark(col, row);
                            }
                        }
                    }

                    stepSimulation();
                    document.getElementById('golGeneration').textContent =
                        `Gen: ${generation}`;
                }
            }

            // Update mesh chaque frame (pour les animations de scale/couleur)
            updateMesh();

            // Update particules spark
            const sp = sparkGeo.attributes.position.array;
            for (let i = 0; i < sparkCount; i++) {
                if (sparkLife[i] > 0) {
                    sparkLife[i]  -= delta * 2;
                    sp[i * 3]     += sparkVel[i * 3];
                    sp[i * 3 + 1] += sparkVel[i * 3 + 1];
                    sp[i * 3 + 2] += sparkVel[i * 3 + 2];
                    sparkVel[i * 3 + 2] -= delta * 0.1;  // gravité légère
                } else {
                    // Téléporter loin de la vue
                    sp[i * 3 + 2] = -100;
                }
            }
            sparkGeo.attributes.position.needsUpdate = true;

            // Rotation très légère de la caméra — effet vivant
            camera.position.x = Math.sin(elapsed * 0.05) * 3;
            camera.position.y = Math.cos(elapsed * 0.03) * 2;
            camera.lookAt(0, 0, 0);

            renderer.render(scene, camera);
        }

        animate();
    })();
}