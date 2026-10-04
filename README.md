# Ali — agent développeur (Cloudflare Pages)

Ali code en direct, explique à voix haute, corrige ses erreurs, teste tes API, sauvegarde tes projets, pousse sur GitHub et déploie sur Vercel ou Cloudflare.

## Déployer Ali sur Cloudflare (aucune variable à configurer)
1. Envoie ce dossier sur GitHub (`git init`, `git add .`, `git commit`, `git push`).
2. Cloudflare > **Workers & Pages** > **Create** > **Pages** > **Connect to Git** > choisis le dépôt.
3. Réglages de build : Framework **None**, Build command **(vide)**, Build output directory **`public`**. Puis **Save and Deploy**.

**Sans GitHub, depuis un téléphone** : utilise `ali-cloudflare-upload.zip` (déjà prêt, avec toutes les fonctions regroupées dans `_worker.js`) : Workers & Pages > Create > Pages > **Upload assets** > donne un nom > téléverse le ZIP > Deploy. (Pour la voix de secours IA : Settings > Bindings > Workers AI, nom `AI`.)

Sur ordinateur : `npx wrangler pages deploy public --project-name ali-agent` (les fonctions du dossier `functions/` sont envoyées avec).

`wrangler.toml` active la voix de secours Workers AI (gratuite dans la limite du quota). Retire le bloc `[ai]` si tu n'en veux pas.

## Comment ça marche
- Chaque utilisateur saisit **ses propres clés** (IA, GitHub, Vercel, Cloudflare, ou n'importe quelle autre) une seule fois : elles restent dans son navigateur.
- Projets, mémoire et variables de chaque projet restent aussi dans le navigateur. Menu > « Sauvegarder mes données » pour garder une copie.
- Le serveur ne stocke rien : il reçoit les clés avec la requête, les utilise, puis les oublie. Pour le chat, il relaie simplement le flux du modèle.
- Modèles : Groq, Gemini, Cerebras, Mistral, OpenRouter ou tout service compatible OpenAI (`CUSTOM_LLM_URL`, `CUSTOM_LLM_MODEL`, `CUSTOM_LLM_KEY`). Si l'un tombe en panne, le suivant répond. Pour changer de modèle : clés `GROQ_MODEL`, `GEMINI_MODEL`, etc.
- **Déployer Cloudflare** (menu) : publie le projet sur un Worker `ali-nom.ton-sous-domaine.workers.dev`, avec ses fonctions `api/` et ses variables chiffrées. Il faut un token API Cloudflare (permission *Workers Scripts : Edit*) et l'Account ID, à ajouter dans Mes clés.
