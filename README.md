# Climbed — gestion et conception 3D de salles d’escalade

Climbed est un projet SaaS destiné aux exploitants de salles d’escalade. Son premier objectif est de permettre à un ouvreur de concevoir facilement des murs de bloc, d’y placer volumes et prises, puis de réserver le matériel nécessaire à leur installation.

Le dépôt technique conserve le nom `CLIMB3D`. Le nom produit retenu dans les échanges est **Climbed**.

## État du projet

- **Phase 0 : cadrage validé par le porteur du projet.**
- **Phase 1 : direction d’architecture acceptée pour le POC.** L’hébergement doit rester simple et les modules remplaçables.
- **Phase 2 : POC local implémenté**, avec éditeur WebGL, API, PostgreSQL et données fictives. Les résultats réels et limites figurent dans [l’avancement](docs/progress.md).
- Le POC ne constitue pas une version commerciale : abonnement, administration complète, import/scan et espace public sont reportés.

## Documents

[Capture réelle du POC dans Chromium](docs/assets/poc-editor.png) : trois pans, cinq volumes et trente-trois prises, dont une fixée sur un volume.

| Document | Objet |
| --- | --- |
| [Spécifications](docs/specifications.md) | Besoins validés, périmètre du POC et parcours métier. |
| [Architecture](docs/architecture.md) | Organisation du logiciel, accès, persistance et exploitation proposés. |
| [Éditeur 3D](docs/editor-3d.md) | Géométrie, interactions, performances et modèles 3D futurs. |
| [Données](docs/database.md) | Entités, réservations, concurrence et invariants. |
| [Décisions](docs/decisions.md) | Distinction entre décisions métier validées et propositions techniques. |
| [Tests](docs/testing.md) | Scénarios et critères de validation à implémenter. |
| [Recherche](docs/research.md) | Sources consultées, versions observées et limites documentaires. |
| [Avancement](docs/progress.md) | Travail réalisé et validations attendues. |
| [Hébergement et évolutions](docs/hosting.md) | Déploiement simple, paiement futur et changements réversibles. |

## Démarrage local

Prérequis : **Node.js 24**, npm et **Docker avec Compose**. Sur Windows 11, Docker Desktop doit fonctionner avec les conteneurs Linux. L’installation Windows n’a pas encore été vérifiée sur un poste réel.

Depuis la racine du dépôt :

```sh
npm ci
npm run setup:local
npm run dev
```

La préparation crée `.env` uniquement s’il est absent, démarre PostgreSQL, applique les migrations et ajoute les données fictives sans écraser les salles existantes. Les données PostgreSQL persistent dans un volume Docker. Le processus web démarre sur le port 5173 et l’API sur le port 3001 ; utiliser le port web dans son navigateur local.

La démo locale fournit `alice@climbed.local` (admin client), `bob@climbed.local` (ouvreur limité à l’Atelier), `manager@climbed.local` (responsable) et `clara@climbed.local` (autre client). Mot de passe de ces comptes **fictifs locaux uniquement** : `climbed-local-demo`. Le seed est manuel et refusé en production. Ces identifiants et ceux du PostgreSQL local ne doivent pas être utilisés pour un pilote exposé à Internet.

## Utiliser l’atelier

1. Choisir une salle, puis ajouter ou sélectionner un pan ; régler ses dimensions, position et inclinaison.
2. Choisir une prise ou un volume dans la bibliothèque, puis cliquer sur le mur. Le même modèle reste actif pour les placements suivants. Échap revient à la sélection.
3. Régler les objets dans les propriétés, composer un bloc et sauvegarder. Une modification peut être annulée/rétablie avant sauvegarde.
4. Dans le matériel, choisir le périmètre de pans à réserver. Le check-in réserve avant le retrait ; confirmer ensuite retrait et installation.
5. Pour libérer le matériel installé, demander son retrait puis confirmer démontage et retour. Une annulation après prélèvement ne libère pas le stock prématurément.

Les profils de fixation sont génériques et non certifiés ; aucun résultat du logiciel ne valide mécaniquement une installation réelle.

## Commandes et vérification

```sh
npm run typecheck
npm test
npm run build
# Avec les processus de développement déjà démarrés :
npm run test:e2e
```

Les tests géométriques et métier utilisent Vitest ; les intégrations PostgreSQL utilisent exclusivement `climbed_test` via `TEST_DATABASE_URL`. Les tests Playwright utilisent Chromium : sous Linux préparé ici, `/usr/bin/chromium` ; ailleurs, définir `CHROMIUM_PATH` ou installer le navigateur Playwright selon [les instructions de test](docs/testing.md). Ils utilisent les fixtures de démo, compensent leurs opérations et restaurent les scènes sans réinitialisation globale.

Le Dockerfile construit une seule application web/API. Le fonctionnement de l’image et les prérequis restants sont consignés dans l’avancement ; aucun déploiement chez un fournisseur n’est effectué automatiquement. Voir [l’hébergement](docs/hosting.md) pour la cible SaaS et le paiement futur.
