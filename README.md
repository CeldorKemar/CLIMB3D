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

[Aperçu de l’éditeur de catalogue](docs/assets/poc-catalog.png).

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
| [Mise à jour sous Windows](docs/update-windows.md) | Télécharger une nouvelle version en conservant PostgreSQL et les salles. |

## Démarrage local

Prérequis : **Node.js 24**, npm et **Docker avec Compose**. Sur Windows 11, Docker Desktop doit fonctionner avec les conteneurs Linux. L’installation Windows n’a pas encore été vérifiée sur un poste réel.

Depuis la racine du dépôt :

```sh
npm ci
npm run setup:local
npm run dev
```

Sous PowerShell, utiliser `npm.cmd` à la place de `npm` si Windows bloque le script `npm.ps1`.

La préparation crée `.env` uniquement s’il est absent, démarre PostgreSQL, applique les migrations et ajoute les données fictives sans écraser les salles existantes. Les données PostgreSQL persistent dans un volume Docker. Le processus web démarre sur le port 5173 et l’API sur le port 3001 ; utiliser le port web dans son navigateur local.

La démo locale fournit `alice@climbed.local` (admin client), `bob@climbed.local` (ouvreur limité à l’Atelier), `manager@climbed.local` (responsable) et `clara@climbed.local` (autre client). Mot de passe de ces comptes **fictifs locaux uniquement** : `climbed-local-demo`. Le seed est manuel et refusé en production. Ces identifiants et ceux du PostgreSQL local ne doivent pas être utilisés pour un pilote exposé à Internet.

## Utiliser l’atelier

1. Choisir une salle, puis ajouter ou sélectionner un pan ; régler ses dimensions, position et inclinaison. L’assistant d’assemblage raccorde plusieurs segments : la longueur se mesure le long du pan, ses projections donnent la hauteur et la profondeur.
2. Choisir une prise ou un volume disponible dans la bibliothèque, puis cliquer sur le mur. Le même modèle reste actif pour les placements suivants. Échap revient à la sélection. Contacts, intersections et empreintes dépassant le pan sont refusés.
3. Régler position et rotation dans la salle. Le catalogue séparé permet de renseigner les formes, dimensions et couleurs des modèles, puis de revenir à la salle sans perdre le brouillon. Un nouveau modèle commence sans stock ; un administrateur ou responsable déclare explicitement la quantité physique avant placement.
4. Créer des voies, associer les mêmes prises ou volumes à plusieurs voies et choisir les voies visibles. Sauvegarder la salle, ou nommer une sauvegarde de voie ; l’historique permet une restauration vérifiée contre les collisions et le stock. Une restauration ne confirme aucun mouvement physique.
5. Dans le matériel, choisir le périmètre de pans à réserver. Le check-in réserve avant le retrait ; confirmer ensuite retrait et installation.
6. Pour libérer le matériel installé, demander son retrait puis confirmer démontage et retour. Une annulation après prélèvement ne libère pas le stock prématurément.

Le catalogue de ce POC reste attaché au document de salle ; la bibliothèque centrale partagée entre toutes les salles du client reste à réaliser. Les pans assemblés sont raccordés à leur création, sans liaison de contrainte permanente pendant les retouches ultérieures. Les profils fabricant vérifiés ne sont pas fournis : les consultations sont encore bloquées par le réseau, voir [la recherche](docs/research.md).

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
