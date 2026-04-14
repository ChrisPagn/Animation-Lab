<!DOCTYPE html>
<html>
<head>
    <style>
        * { box-sizing: border-box; }
        body { background:#626266; margin:0; font-family:'Inter',system-ui,sans-serif; overflow-x:hidden; }
        .menu-toggle-btn { position:fixed; left:1rem; top:1rem; background:rgba(0,0,0,0.8); border:1px solid #00ffcc; color:#00ffcc; padding:0.8rem 1rem; border-radius:8px; cursor:pointer; z-index:1001; font-size:1rem; backdrop-filter: blur(10px); }
        .sidebar { position:fixed; left:0; top:0; width:280px; height:100vh; background:rgba(10,10,20,0.98); transform:translateX(-100%); transition:transform 0.3s cubic-bezier(0.4,0,0.2,1); z-index:1000; padding:5rem 1.5rem 2rem; box-shadow:2px 0 20px rgba(0,0,0,0.5); backdrop-filter: blur(20px); }
        .sidebar.open { transform: translateX(0); }
        .sidebar h3 { color:#00ffcc; margin:0 0 1.5rem 0; font-size:1.3rem; }
        .nav-section { margin-bottom:1.5rem; }
        .nav-section strong { display:block; color:#fff; margin-bottom:0.5rem; font-size:1.05rem; }
        .sidebar a { color:#ccc; text-decoration:none; display:block; padding:0.45rem 0; transition:color 0.2s; }
        .sidebar a:hover { color:#00ffcc; }

        .main-content { padding: 2rem 2rem 2rem 300px; }
        .section-title { color:#00ffcc; font-size:1.8rem; margin:2rem 0 1rem; text-align:center; position:relative; }
        .section-title::after { content:''; display:block; width:60px; height:3px; background:linear-gradient(90deg, transparent, #00ffcc, transparent); margin:0.5rem auto; }
        .intro { max-width:900px; margin:0 auto 1.5rem; color:#e8f6ff; text-align:center; line-height:1.6; }

        .canvas-wrapper { max-width: 960px; margin: 0 auto 2.5rem; background: rgba(10,10,20,0.9); border:1px solid rgba(255,255,255,0.1); border-radius:18px; padding:1rem 1rem 1.4rem; box-shadow:0 12px 36px rgba(0,0,0,0.35); overflow:hidden; }
        .canvas-wrapper h1 { margin:0 0 0.6rem; font-size:1.15rem; color:#e8f6ff; }
        canvas { width:100%; height:clamp(280px, 58vw, 520px); border-radius:18px; border:1px solid rgba(255,255,255,0.15); box-shadow:0 10px 40px rgba(0,0,0,0.4); transition: all 0.35s cubic-bezier(0.25,0.46,0.45,0.94); cursor:pointer; display:block; }
        canvas:hover { transform: translateY(-4px) scale(1.01); box-shadow: 0 20px 60px rgba(0,255,204,0.2); border-color: rgba(0,255,204,0.4); }

        @media (max-width: 1024px) { .main-content { padding-left:2rem; padding-right:2rem; } }
        @media (max-width: 768px) { .menu-toggle-btn { left:1rem; top:1.5rem; } .sidebar { width:85vw; padding:6rem 2rem 3rem; } .main-content { padding:6rem 1rem 2rem; } canvas { height:55vh; } }
        @media (max-width: 480px) { .sidebar { width:95vw; padding:5rem 1.5rem 2rem; } canvas { height:50vh; } }
    </style>
    <title>Animations Lab — Portfolio</title>
</head>
<body class="main-content">
    <button id="menuToggle" class="menu-toggle-btn">☰ Menu</button>
    <nav id="sidebarNav" class="sidebar">
        <h3>Portfolio Animations</h3>
        <div class="nav-section">
            <strong>Pages</strong>
            <a href="/">🏠 Accueil</a>
            <a href="/loaders">🔄 Loaders</a>
            <a href="/demos">🎨 Démos</a>
            <a href="/transitions">✨ Transitions</a>
        </div>
    </nav>

    <main>
        <h2 class="section-title">Identité & Logo Particules</h2>
        <div class="intro">
            Logo “ANIMATIONS LAB” généré en points lumineux, morphing depuis un nuage de particules aléatoires vers une forme typographique avec bloom subtil. Contrôles dédiés pour jouer sur la vitesse et ré-initialiser le morph.
        </div>
        <div class="canvas-wrapper">
            <h1>Logo Portfolio — Particules Morphing</h1>
            <canvas id="portfolioLogoCanvas" width="900" height="520"></canvas>
        </div>
    </main>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const menuToggle = document.getElementById('menuToggle');
            const sidebar = document.getElementById('sidebarNav');
            if (menuToggle && sidebar) menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
            document.addEventListener('click', (e) => { if (sidebar && !sidebar.contains(e.target) && !menuToggle?.contains(e.target)) sidebar.classList.remove('open'); });
            document.querySelector('main').addEventListener('dblclick', (e) => { if (e.target.tagName === 'CANVAS') toggleFullscreen(e.target); });
            function toggleFullscreen(el){ if (!document.fullscreenElement) el.requestFullscreen?.(); else document.exitFullscreen?.(); }
        });
    </script>
    @vite(['resources/js/app.js'])
</body>
</html>
