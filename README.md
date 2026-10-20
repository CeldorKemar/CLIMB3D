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

[Aperçu de l’éditeur de catalogue](docs/assets/poc-catalog.png) · [Plan et panneau des niveaux](docs/assets/poc-levels.png) · [Pyramide à inserts de démonstration](docs/assets/poc-pyramid.png).

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
3. Régler position et rotation dans la salle. L’icône de bibliothèque dans le menu tout à gauche ouvre le catalogue séparé, avec onglets prises/volumes et recherche libre. On y renseigne les formes, dimensions et couleurs, puis on revient à la salle sans perdre le brouillon. Un nouveau modèle commence sans stock ; un administrateur ou responsable déclare explicitement la quantité physique avant placement.
4. Créer des voies, associer les mêmes prises ou volumes à plusieurs voies et choisir les voies visibles. Sauvegarder la salle, ou nommer une sauvegarde de voie ; l’historique permet une restauration vérifiée contre les collisions et le stock. Une restauration ne confirme aucun mouvement physique.
5. Dans le matériel, choisir le périmètre de pans à réserver. Le check-in réserve avant le retrait ; confirmer ensuite retrait et installation.
6. Pour libérer le matériel installé, demander son retrait puis confirmer démontage et retour. Une annulation après prélèvement ne libère pas le stock prématurément.

Le catalogue de ce POC reste attaché au document de salle ; la bibliothèque centrale partagée entre toutes les salles du client reste à réaliser. Les pans assemblés sont raccordés à leur création, sans liaison de contrainte permanente pendant les retouches ultérieures. Les profils fabricant vérifiés ne sont pas fournis : les consultations sont encore bloquées par le réseau, voir [la recherche](docs/research.md).

Sur une sélection de salle : **Suppr** ou **Retour arrière** supprime, **Ctrl+C / Ctrl+V** copie et colle, **Ctrl+D** duplique, **Ctrl+Z** annule. Les copies d’un pan incluent ses volumes, prises et associations de voies ; elles respectent le stock et les collisions. Le presse-papiers reste local à cette salle et les champs de saisie conservent leurs raccourcis natifs. L’assistant de murs affiche les raisons détaillées d’un refus, sans ajouter de segments partiels.

**Ctrl + clic gauche** sélectionne plusieurs prises ou volumes ; le panneau propose alors uniquement leur suppression groupée, annulable. La suppression d’une voie propose aussi de retirer ses pièces exclusives, en conservant les pièces partagées et les supports nécessaires.

Le **plan de la salle**, en bas à droite, affiche les pans à leurs coordonnées réelles en vue du dessus. Il se masque, s’agrandit et permet de cadrer un pan en cliquant dessus. Le menu **Niveaux** permet de définir les sols, leurs altitudes, les pans associés et des escaliers droits. Les niveaux font partie de la sauvegarde de salle. Le plan affiche uniquement les pans, sans sols ni escaliers.

Les prises et volumes de démonstration possèdent des trous traversants. L’aperçu devient vert lorsque le placement est accepté, rouge avec les raisons du refus. Les objets boulonnés s’accrochent aux inserts compatibles ; les objets vissés exigent par défaut des trous pilotes compatibles. Tous les trous du modèle sont obligatoires. Le vissage direct doit être explicitement autorisé dans son profil et par son support. La même validation s’applique côté serveur. Voir [les fixations](docs/fixations.md) pour les données et limites des exemples.

Sélectionner un pan ou un sol pour afficher les boutons **X−/X+, Y−/Y+, Z−/Z+**. Les flèches agissent sur X/Y, **Alt + haut/bas** sur Z, **Maj** multiplie le pas par dix. Un sol se sélectionne aussi dans le panneau des niveaux. Son déplacement vertical transporte ses pans ; son déplacement horizontal déplace uniquement son contour. Les opérations se sauvegardent et s’annulent dans le brouillon.

Dans le catalogue, les boutons **Pyramide à inserts · démo** et **Dôme à 4 boulons · démo** ajoutent des profils synthétiques distincts. La pyramide reçoit des prises sur ses quatre inserts inclinés. Déclarer leur stock avant placement. Pour un volume vissé sur un support prépercé, renseigner la trame de trous pilotes dans les propriétés du pan ; les marqueurs orange sont distincts des inserts. Un modèle déjà inventorié doit être dupliqué pour changer son profil.

Dans le catalogue, **Mode de fixation** propose boulons sur inserts, vis sur pilotes et vissage direct. Ces modes existent pour les prises et les volumes. Les trous de la pièce sont conservés quand on change de mode.

Pour préparer un support : le sélectionner, activer **Autoriser le préperçage de ce support** si le produit le permet, puis choisir une pièce, cocher **Préparer les trous pilotes puis placer** et saisir le diamètre pilote en millimètres. L’aperçu affiche les trous à préparer. Le clic ajoute les trous et la pièce ensemble ; une seule annulation retire cette opération. Sur un volume, seuls les trous de cet exemplaire sont modifiés. Une interdiction du profil produit bloque la préparation.

Pour modifier les trous de la pièce elle-même : ouvrir l’éditeur de catalogue, dupliquer le modèle s’il possède du stock ou des placements, puis renseigner **Référence autorisant la modification**. On peut alors ajouter, déplacer, dimensionner ou supprimer ses trous de fixation et préciser leur rôle. La référence est une déclaration de l’utilisateur, sans vérification documentaire automatique. Les vérifications géométriques restent actives. Le diamètre du pilote dans le support se renseigne séparément du diamètre de passage de la pièce.

Les profils de fixation sont génériques et non certifiés ; aucun résultat du logiciel ne valide mécaniquement une installation réelle.

## Commandes et vérification

```sh
npm run typecheck
npm test
npm run build
# Avec un serveur et une base de fixtures dédiés (voir docs/testing.md) :
npm run test:e2e
```

Les tests géométriques et métier utilisent Vitest ; les intégrations PostgreSQL utilisent exclusivement `climbed_test` via `TEST_DATABASE_URL`. Les tests Playwright utilisent Chromium : sous Linux préparé ici, `/usr/bin/chromium` ; ailleurs, définir `CHROMIUM_PATH` ou installer le navigateur Playwright selon [les instructions de test](docs/testing.md). Les tests de cette révision utilisent une base de fixtures dédiée sans placements hérités, compensent leurs opérations et restaurent leurs scènes. Ne pas les diriger vers une salle de travail.

Le Dockerfile construit une seule application web/API. Le fonctionnement de l’image et les prérequis restants sont consignés dans l’avancement ; aucun déploiement chez un fournisseur n’est effectué automatiquement. Voir [l’hébergement](docs/hosting.md) pour la cible SaaS et le paiement futur.
