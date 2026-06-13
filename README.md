# Moody 🎚️

**Votre trajet à Paris, selon votre humeur.**

Moody génère des itinéraires parisiens **multimodaux** (métro, RER, Vélib’, marche)
qui s'adaptent à votre **mood** du moment. Pas juste « le plus rapide » : le plus
*zen*, le plus *sportif*, le plus *flâneur* ou le plus *économe*.

> Exemple : du 20e à Boulogne en mode **Zen**, Moody propose *une seule ligne de
> métro (la 9) + un bout de Vélib’* — zéro correspondance — là où le mode **Pressé**
> enchaîne `3 → 9` pour gagner 7 minutes.

---

## Les moods

| Mood | Intention | Ce que l'algorithme privilégie |
|------|-----------|-------------------------------|
| ⚡️ **Pressé·e** | Le plus rapide, point | Temps minimal, correspondances acceptées |
| 🧘 **Zen** | Le moins de prise de tête | Une seule ligne, zéro correspondance |
| 🚴 **Énergie** | J'ai envie de bouger | Maximum de Vélib’ et de marche |
| 🌿 **Flâneur·euse** | Prendre l'air, voir la ville | La surface plutôt que le souterrain |
| 🪙 **Économe** | Au meilleur prix | Le moins de tickets possible |

Chaque mood est une **fonction de coût** sur l'itinéraire. Le moteur génère un
éventail de trajets candidats (métro direct, métro + Vélib’, une-seule-ligne +
Vélib’, Vélib’ intégral, à pied…) puis les **classe** selon les poids du mood actif.

## Données — réelles, temps réel, sans clé API

- **Graphe métro/RER** : stations, ordre des lignes et temps inter-stations dérivés
  d'un export GTFS RATP/IDFM (598 nœuds, 1762 arêtes, lignes 1–14 + 3bis/7bis + RER A/B).
- **Vélib’ temps réel** : disponibilité vélos/bornes via `opendata.paris.fr`
  (1517 stations), avec un **snapshot embarqué en fallback** si le flux est indisponible.
- **Géocodage d'adresses** : Base Adresse Nationale (`api-adresse.data.gouv.fr`).
- **Météo** : Open-Meteo (note contextuelle pluie/chaleur/froid).

Aucune clé API requise : l'app fonctionne out-of-the-box.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** — design sobre, mobile-first
- **Leaflet** + fonds de carte **CARTO Positron**
- Moteur de routing **pur TypeScript** (testable, sans dépendance réseau)
- Tests : **Vitest** (moteur) + **Playwright** (E2E)

## Démarrer en local

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Autres commandes :

```bash
pnpm build          # build de production
pnpm test           # tests unitaires du moteur (Vitest)
pnpm e2e            # tests end-to-end (Playwright)
pnpm typecheck      # vérification TypeScript
```

## Architecture

```
app/
  page.tsx              UI principale (client)
  api/
    geocode/route.ts    autocomplétion d'adresses (BAN)
    route/route.ts      calcul d'itinéraire (Vélib’ live + moteur + météo)
components/             carte Leaflet, sélecteur de mood, champ d'adresse, timeline
lib/
  router.ts             génération des candidats + scoring par mood
  metro.ts              graphe métro + Dijkstra multi-source
  velib.ts              proximité Vélib’ (vélos/bornes)
  moods.ts              les 5 profils de mood
  geo.ts                vitesses, distances, constantes
data/
  metro.json            graphe métro/RER
  velib-stations.json   snapshot Vélib’ (fallback)
```

## Comment marche le moteur (en bref)

1. **Géocodage** du départ et de l'arrivée.
2. **Génération de candidats** : pour chaque stratégie (métro direct, une-seule-ligne
   + Vélib’ d'approche/sortie, Vélib’ intégral, marche…), on construit un itinéraire
   complet via un Dijkstra multi-source sur le graphe métro, avec connecteurs
   premier/dernier kilomètre à pied ou en Vélib’.
3. **Scoring** : chaque candidat est noté par la fonction de coût du mood
   (temps, correspondances, marche, vélo, souterrain, prix — certains poids
   *récompensent* un attribut, ex. le vélo en mode Énergie).
4. On renvoie le **meilleur** + des **alternatives** distinctes.

## Limites

Démo : les temps sont modélisés (vitesses moyennes + temps GTFS), sans horaires
temps réel des trains ni perturbations de trafic. Vérifiez les horaires officiels
avant de partir.

---

Données : Île-de-France Mobilités · Vélib’ Métropole · Base Adresse Nationale · Open-Meteo · fonds CARTO/OpenStreetMap.
