<!DOCTYPE html>
<html>
<head>
    <style>
        * { box-sizing: border-box; }
        body {
            background: #626266;
            margin: 0;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            overflow-x: hidden;
            scroll-behavior: smooth;
        }

        .menu-toggle-btn {
            position: fixed;
            left: 1rem;
            top: 1rem;
            background: rgba(0,0,0,0.8);
            border: 1px solid #00ffcc;
            color: #00ffcc;
            padding: 0.8rem 1rem;
            border-radius: 8px;
            cursor: pointer;
            z-index: 1001;
            font-size: 1rem;
            backdrop-filter: blur(10px);
        }

        .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            width: 260px;
            height: 100vh;
            background: rgba(10,10,20,0.98);
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
            z-index: 1000;
            padding: 5rem 1.5rem 2rem;
            box-shadow: 2px 0 20px rgba(0,0,0,0.5);
            backdrop-filter: blur(20px);
        }
        .sidebar.open { transform: translateX(0); }
        .sidebar h3 { color: #00ffcc; margin: 0 0 1.2rem 0; font-size: 1.2rem; }
        .nav-section { margin-bottom: 1.4rem; }
        .nav-section strong { display: block; color: #fff; margin-bottom: 0.5rem; font-size: 1rem; }
        .sidebar a { color: #ccc; text-decoration: none; display: block; padding: 0.45rem 0; transition: color 0.2s; }
        .sidebar a:hover { color: #00ffcc; }

        .main-content { padding: 2rem 2rem 2rem 300px; max-width: none; }

        .hero {
            max-width: 1100px;
            margin: 2rem auto 1.5rem;
            background: radial-gradient(circle at 20% 20%, rgba(0,255,204,0.12), transparent 45%), rgba(10,10,18,0.92);
            border: 1px solid rgba(0,255,204,0.25);
            border-radius: 24px;
            padding: 2rem 2.2rem;
            color: #e8f6ff;
            box-shadow: 0 25px 80px rgba(0,0,0,0.35);
        }
        .hero h1 { margin: 0 0 0.6rem; font-size: 2rem; letter-spacing: 0.5px; }
        .hero p { margin: 0; line-height: 1.6; color: #c9d8e5; }

        .card-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 1.2rem;
            max-width: 1100px;
            margin: 1rem auto 3rem;
        }
        .card {
            background: linear-gradient(145deg, rgba(20,20,30,0.95), rgba(10,10,20,0.92));
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 18px;
            padding: 1.3rem 1.4rem;
            color: #e8f6ff;
            box-shadow: 0 16px 40px rgba(0,0,0,0.35);
            position: relative;
            overflow: hidden;
            transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .card:hover {
            transform: translateY(-4px);
            border-color: rgba(0,255,204,0.35);
            box-shadow: 0 20px 50px rgba(0,255,204,0.12);
        }
        .card h3 { margin: 0 0 0.4rem; font-size: 1.2rem; color: #00ffcc; }
        .card p { margin: 0 0 0.8rem; color: #c9d8e5; line-height: 1.5; font-size: 0.95rem; }
        .card a { display: inline-flex; align-items: center; gap: 0.35rem; color: #0cf0ff; font-weight: 600; text-decoration: none; font-size: 0.95rem; }
        .card a::after { content: '→'; opacity: 0.7; transition: transform 0.2s ease; }
        .card a:hover::after { transform: translateX(4px); }

        @media (max-width: 1024px) {
            .main-content { padding-left: 2rem; padding-right: 2rem; }
            .card-grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
            .card h3 { font-size: 1.1rem; }
            .card p { font-size: 0.92rem; }
        }
        @media (max-width: 768px) {
            .menu-toggle-btn { left: 1rem; top: 1.5rem; }
            .sidebar { width: 85vw; padding: 6rem 2rem 3rem; }
            .main-content { padding: 6rem 1rem 2rem; }
        }
        @media (max-width: 480px) {
            .sidebar { width: 95vw; padding: 5rem 1.5rem 2rem; }
        }
    </style>
    <title>Animations Lab — Index</title>
</head>
<body class="main-content">
    <button id="menuToggle" class="menu-toggle-btn">☰ Menu</button>
    <nav id="sidebarNav" class="sidebar">
        <h3>Portfolio Animations</h3>
        <div class="nav-section">
            <strong>Pages</strong>
            <a href="/loaders">🔄 Loaders</a>
            <a href="/demos">🎨 Démos</a>
            <a href="/transitions">✨ Transitions</a>
            <a href="/portfolio">💠 Portfolio</a>
        </div>
    </nav>

    <main class="main-content">
        <div class="hero">
            <h1>Animation Lab — Three.js</h1>
            <p>Collection d’expériences visuelles : loaders, démos temps-réel, transitions, et identités de marque en particules. Choisis un thème pour parcourir une page dédiée, plus légère et rapide.</p>
        </div>

        <div class="card-grid">
            <div class="card">
                <h3>Loaders</h3>
                <p>Réseaux, ADN, hexagones, sphères de données et logos en particules.</p>
                <a href="/loaders">Voir les loaders</a>
            </div>
            <div class="card">
                <h3>Démos</h3>
                <p>Océan, morphing, terrains, wormhole, galaxy bloom, WebGPU triangle & cube.</p>
                <a href="/demos">Voir les démos</a>
            </div>
            <div class="card">
                <h3>Transitions</h3>
                <p>Rideau de particules, morphing liquide et flipbook animé.</p>
                <a href="/transitions">Voir les transitions</a>
            </div>
            <div class="card">
                <h3>Portfolio</h3>
                <p>Logo en particules morphing et expériences de marque.</p>
                <a href="/portfolio">Voir le portfolio</a>
            </div>
        </div>
    </main>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const menuToggle = document.getElementById('menuToggle');
            const sidebar = document.getElementById('sidebarNav');
            if (menuToggle && sidebar) {
                menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
            }
            document.addEventListener('click', (e) => {
                if (sidebar && !sidebar.contains(e.target) && !menuToggle?.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            });
        });
    </script>
</body>
</html>
