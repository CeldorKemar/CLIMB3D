# Stratégie de validation du POC Climbed

Ce document décrit la stratégie cible et ses critères. Certains scénarios sont maintenant implémentés dans le POC ; les résultats réellement obtenus figurent dans [progress.md](progress.md). Une ligne de cette matrice ne signifie pas à elle seule que le scénario correspondant a été exécuté ou que toute la fonctionnalité V1 existe.

## Ce qui doit être démontré

Un ouvreur utilise un laptop pour construire une zone de bloc, équiper les surfaces et les volumes autorisés, composer des voies et retrouver son projet après sauvegarde. La bibliothèque bloque les ajouts indisponibles ; le check-in confirme ensuite la disponibilité réelle face aux réservations concurrentes, avant de prendre les pièces en réserve. L’installation et le retour physique nécessitent des confirmations distinctes. Les données restent isolées entre clients, avec des permissions limitées par salle.

La validation combine tests automatisés et essais par des ouvreurs. Un rendu convaincant ne démontre ni la cohérence du stock, ni la simplicité de l’interface ; chaque aspect possède ses propres critères.

## Matrice d’acceptation du premier prototype

| Domaine | Scénario de référence | Critère de réussite | Validation prévue |
|---|---|---|---|
| Pans | Assembler un mur vertical, un dévers et un toit ; déplacer leurs sommets et changer leurs angles. | Dimensions et raccords restent déterministes ; les formes invalides sont refusées avec une explication ; le projet reste récupérable après refus. | Vitest pour les calculs ; Playwright et essai manuel pour les gestes. |
| Ouvertures | Créer une ouverture traversante dans un pan, distincte des points de fixation. | Le trou possède un contour et une épaisseur cohérents ; le picking ne sélectionne pas une surface inexistante ; aucune prise ne se fixe dans le vide. | Tests géométriques, rayons traversants et inspection WebGL. |
| Volumes | Poser boîte, pyramide, prisme, dôme et forme creuse ; modifier leurs dimensions. | Le modèle possède la forme attendue, notamment une cavité réelle pour les formes creuses ; ses capacités de fixation sont explicites. | Vitest, rendu dans le navigateur et scénarios manuels. |
| Placement | Choisir une prise et cliquer plusieurs fois sur des surfaces différemment inclinées. | Chaque placement suit la surface visée ; son orientation initiale utilise la normale et sa rotation utilise le repère local du support. Les placements ne se retournent pas au passage d’une orientation particulière. | Vitest sur transformations ; Playwright sur clics et picking WebGL. |
| Supports | Fixer des prises sur un volume compatible puis déplacer et tourner ce volume. | Les prises suivent le support sans dérive ; les surfaces incompatibles sont refusées ; un volume ne peut pas être posé sur un autre volume en V1. | Tests de transformations, API et interface. |
| Fixations | Définir une trame et des points individuels sur un support. | Le POC contraint les nouveaux placements selon les inserts et surfaces autorisées du modèle ; les anciennes ancres inchangées sont conservées. | Vitest, tests métier et essai manuel. |
| Bloc | Associer une même prise physique à plusieurs blocs et définir départs et arrivée. | Les associations restent distinctes des placements physiques ; la pièce ne consomme qu’un exemplaire en stock. | Tests métier sur PostgreSQL et parcours de bout en bout. |
| Persistance | Sauvegarder, fermer puis recharger une scène avec placements imbriqués. | Géométrie, dimensions, orientations, supports, blocs et versions sont restitués dans les tolérances définies. Aucune dépendance à l’ordre de sélection ou de chargement. | Sérialisation Vitest, API et rechargement navigateur. |
| Projet et installation | Modifier un brouillon alors qu’une version antérieure est installée. | L’installation référence toujours sa version exacte ; les modifications théoriques ne déplacent ni matériel ni stock réel. | Tests métier et parcours avec deux versions. |
| Réservation | Deux ouvreurs réservent simultanément le dernier exemplaire disponible. | Une seule réservation réussit ; l’autre reçoit un conflit compréhensible ; aucun stock négatif ni effet partiel. | Test concurrent sur PostgreSQL réel. |
| Installation | Réserver les pièces, puis confirmer leur installation. | Les états et l’auteur sont historisés ; les pièces réservées restent indisponibles pour les autres ouvreurs ; la confirmation ne les consomme pas deux fois. | API transactionnelle et parcours utilisateur. |
| Modification | Ajouter une prise et en retirer une sur un mur installé. | Seuls les ajouts sont réservés ; un retrait reste indisponible tant que démontage et retour ne sont pas confirmés. | Tests de delta, transactions et interface. |
| Retour | Demander le démontage, puis confirmer le retour d’une pièce. | La demande seule ne libère rien ; la confirmation libère exactement l’exemplaire concerné et ne peut pas être appliquée deux fois. | API, répétition de requêtes et parcours utilisateur. |
| Cloisonnement | Un client soumet les identifiants d’un autre client ; un ouvreur vise une salle non autorisée. | Aucune lecture, écriture, export ou récupération de ressource privée n’est possible ; le refus ne révèle pas les données du tiers. | Tests négatifs API et accès aux fichiers. |
| Catalogue et stock | Deux salles du même client utilisent le même modèle de prise. | Le modèle est partagé, mais la réservation d’un exemplaire dans une salle ne consomme pas le stock de l’autre. | Tests métier et parcours multisalle. |

## Répartition des tests

### Calculs et géométrie : Vitest

Les tests portent sur des propriétés métier et géométriques, sans recopier les fonctions internes : stabilité des conversions de repères, cohérence des normales, composition des transformations, dimensions connues, intersection avec une surface et absence d’intersection à travers une ouverture. Ils couvrent les angles limites, changements de taille, coordonnées négatives et orientations de toit. Les tolérances numériques sont explicites et adaptées à l’unité canonique retenue dans le contrat de scène.

Les formes invalides sont des données d’essai : polygone auto-intersecté, surface de taille nulle, valeurs non finies, cavité dépassant la forme, fixation hors surface et référence à un support supprimé. Le comportement attendu est un refus explicite ou une opération corrective documentée, sans scène corrompue. Les changements de géométrie du support ne doivent jamais déplacer silencieusement des prises vers une surface sans rapport.

### API et stock : PostgreSQL réel

Pour la piste NestJS / Prisma / PostgreSQL, les tests d’intégration utilisent une base PostgreSQL dédiée, avec migrations, contraintes et transactions réelles. Les mocks ne suffisent pas à établir la sécurité des réservations concurrentes. Chaque scénario recrée ses propres données et attend la fin de toutes les transactions avant d’inspecter l’état final.

Les assertions inspectent ensemble réservation, exemplaires, installation, version du projet, journal métier et clé d’idempotence. Elles vérifient ces invariants :

- Un exemplaire physique ne possède qu’une affectation active ; disponible, réservé, installé et en attente de retour ne se cumulent pas.
- Un exemplaire réservé ou installé appartient au client et à la salle autorisés et référence un projet ainsi qu’une version identifiables.
- Un échec annule tous les effets de la commande, y compris le journal métier de succès et l’enregistrement d’un résultat idempotent réussi.
- Une répétition de la même commande avec la même clé d’idempotence ne crée ni double réservation, ni double retour. Elle restitue le résultat même si la commande initiale a fait progresser la révision attendue, sous réserve des droits actuels. La réutilisation de la clé avec une autre charge utile est refusée.
- Un passage de version calcule le delta des exemplaires ou placements physiques, pas une somme des associations entre prises et blocs.
- Une modification concurrente fondée sur une version périmée est refusée ou explicitement réconciliée, sans écrasement silencieux.

La suite inclut au minimum : deux transactions visant le dernier exemplaire ; réservations partiellement compatibles pour un lot de plusieurs pièces ; échec après une première écriture ; conflit d’édition ; répétition après délai réseau ; annulation face à confirmation d’installation ; double confirmation de retour ; annulation d’un retrait encore physiquement installé. Pour un lot indisponible, la réservation est atomique : aucune pièce n’est immobilisée par une opération rejetée.

Une réservation annulée peut libérer une pièce encore en réserve. Si une pièce a déjà été retirée physiquement, l’annulation doit passer par une confirmation de retour. Cette distinction doit être matérialisée dans le parcours avant validation du pilote ; une expiration automatique ne suffit pas à prouver qu’une pièce est revenue.

### Identités et autorisations

La recommandation est une session vérifiée côté serveur. Les permissions et appartenances ne sont jamais déduites d’un identifiant de salle fourni par le navigateur sans contrôle serveur. Si des JWT sont finalement retenus, les mêmes tests s’appliquent, avec expiration, révocation et actualisation des droits ; le simple contenu d’un jeton valide ne dispense pas du contrôle de portée.

La matrice couvre superadmin, admin client, responsable de salle et ouvreur : opérations autorisées, opérations refusées, plusieurs appartenances, retrait d’une permission et session expirée. Les opérations de gestion des membres et du stock exigent des permissions explicites ; les droits de conception ne doivent pas les accorder implicitement. Les accès exceptionnels du superadmin sont identifiables dans le journal.

Le jeu de tests comprend deux clients ayant des noms identiques, deux salles d’un même client et une salle du second client. Les requêtes malveillantes remplacent aussi les identifiants dans les ressources imbriquées : modèle, exemplaire, réservation, version de scène et fichier. Les contrôles couvrent API, téléchargements et éventuels liens temporaires d’assets. Les réponses et journaux accessibles à un client ne révèlent pas les données d’un autre.

### Interface et WebGL : Playwright

Les parcours s’exécutent dans de vrais navigateurs avec WebGL disponible. L’absence de contexte WebGL ne compte pas comme un test réussi : elle produit un échec de prérequis clairement visible. Une capture ou une assertion sur le DOM seule ne valide pas une scène 3D.

Les scénarios exécutent les gestes réels de création, navigation caméra, sélection, placement répété, rotation et sauvegarde. Des rayons ou points de référence indépendants permettent de contrôler que la surface visée correspond au placement obtenu. Les captures comparatives utilisent une caméra et un éclairage fixes, avec tolérance aux différences de GPU ; elles complètent les contrôles géométriques. Une assertion sur le même calcul que celui de l’éditeur n’est pas une preuve indépendante de picking correct.

La campagne initiale vise Chromium ; un contrôle de compatibilité Firefox et Safari/WebKit précède le pilote selon les navigateurs réellement utilisés. Les tests sous rendu logiciel en CI valident le fonctionnement, pas la fluidité d’un laptop équipé d’un GPU.

## Données de référence et performance

La photo fournie sert de référence visuelle de densité, pas de mesure des angles ou des quantités exactes. Trois scènes déterministes sont préparées :

| Jeu | Composition indicative | Utilité |
|---|---|---|
| Minimal | Trois pans, un volume compatible, quelques prises, deux blocs partageant une prise. | Diagnostic fonctionnel, coordonnées et stock contrôlables à la main. |
| POC de référence | 20 pans, 30 volumes, 500 prises ; catalogue d’environ 40 géométries réutilisées. | Navigation, placement, sélection, sauvegarde et chargement sur laptop. |
| Limite | Doublement progressif du nombre de placements, formes creuses et géométries moins répétées. | Identifier la dégradation, les limites de mémoire et les besoins de simplification. |

Ces volumes sont un budget initial à confirmer avec les pilotes. Les futurs scans ne doivent pas hériter de ce budget en supposant que toutes les géométries ont le même coût : triangles, textures, matériaux et nombre de versions sont également mesurés.

Les relevés indiquent modèle de laptop, CPU, GPU, RAM, système, navigateur/version, dimensions du viewport, résolution et ratio de pixels. Valeur de départ proposée : écran 1920 × 1080, viewport 1440 × 900, ratio de pixels plafonné explicitement pour le benchmark ; un viewport 1366 × 768 vérifie aussi l’encombrement des outils. Le matériel cible reste à choisir ; aucun seuil n’est actuellement garanti.

Objectifs provisoires à éprouver sur le laptop de référence : navigation visant 30 images/s ou plus sur la scène POC ; retour visible d’un clic de sélection ou placement en moins de 100 ms au 95e percentile pendant une séquence définie. Les temps de chargement et sauvegarde sont mesurés séparément avec réseau et cache documentés, avant de fixer des seuils d’acceptation. Le benchmark inclut une phase d’échauffement et plusieurs séquences identiques ; il rapporte médiane, percentiles, longues pauses, mémoire et taille des fichiers. Le rapport distingue première ouverture et cache chaud.

## Compatibilité future avec les modèles scannés ou modélisés

Le scan et son traitement ne sont pas implémentés dans le POC. Le contrat à préserver sépare l’identité métier de l’objet, sa source géométrique paramétrique ou issue d’un asset et sa version immuable. Une installation et un placement restent attachés à une version précise : remplacer un fichier ne doit jamais modifier rétroactivement une scène installée.

Les tests de contrat futurs couvriront : unité source et conversion canonique, axes et orientation, origine, dimensions, empreinte cryptographique de l’asset, version du format et droits d’accès. Le rendu détaillé, les surfaces de fixation et la géométrie de sélection peuvent être différents ; leurs correspondances doivent être explicites. Un scan ne prouve pas à lui seul l’existence d’un insert, la possibilité de fixer une prise ou la capacité mécanique du support.

Les ancrages sont stables dans la version de géométrie de référence. Une réimportation qui change la topologie ne doit pas réaffecter une prise à un triangle arbitraire. Un test de remplacement vérifie que l’ancien asset reste disponible pour ses scènes et qu’une migration d’ancrage exige une correspondance vérifiée ou une intervention de l’utilisateur. Le POC peut vérifier ce contrat avec de petits assets synthétiques sans développer un parcours d’import ou de scan.

## Recette terrain et limites

Un ouvreur réalise le parcours sans guidage étape par étape : construire une zone représentative, l’équiper, corriger un placement, créer un bloc, réserver, confirmer l’installation, ajuster puis rendre une pièce. Un deuxième ouvreur exécute en parallèle une réservation conflictuelle. On relève durée, erreurs, gestes difficiles et besoin d’assistance ; la réussite est examinée avec les utilisateurs pilotes, pas seulement par l’équipe technique.

Le POC ne certifie ni stabilité structurelle, ni conformité réglementaire, ni résistance d’une fixation. La présence géométrique d’un point ou une compatibilité déclarée n’est pas une validation mécanique. Les caractéristiques fabricant restent marquées comme non vérifiées jusqu’à consultation de sources identifiées.

Le stock logiciel dépend des confirmations terrain. Il ne détecte pas automatiquement une perte, une casse ou un prélèvement non déclaré. Les scénarios de recette doivent distinguer cohérence transactionnelle et exactitude de l’inventaire physique. Les transferts entre salles, pièces cassées ou manquantes et corrections d’inventaire exigent des règles explicites avant une utilisation commerciale ; ils ne doivent pas être simulés par de fausses confirmations d’installation ou de retour.

## Jalons de validation

1. Valider transformations, surfaces et format de sauvegarde sur la scène minimale, puis les gestes de l’éditeur dans un navigateur.
2. Valider identité, cloisonnement et transactions de réservation sur PostgreSQL avant de connecter le parcours à du stock utilisé en pilote.
3. Relier version théorique, préparation et installation, puis démontrer delta, annulation, retour et conflits avec deux ouvreurs.
4. Mesurer la scène POC sur le laptop retenu et réaliser la recette avec un ouvreur ; consigner les limites avant extension du pilote.

Chaque rapport futur indiquera commit, configuration, données utilisées, commandes, résultats et limites. Les captures et mesures seront datées. Une suite écrite mais non exécutée restera signalée comme telle.

## Exécuter les contrôles du POC

Depuis la racine, avec Node 24 et Docker fonctionnel :

```sh
npm ci
npm run setup:local
npm test
npm run build
npm start
```

Dans un second terminal, pour tester l'interface compilée servie par l'API :

```sh
# Linux/macOS ; sous PowerShell, affecter WEB_BASE_URL via $env:WEB_BASE_URL.
WEB_BASE_URL=http://localhost:3001 npm run test:e2e
```

En développement Vite (`npm run dev`), le port web de référence des tests est 5173 par défaut. Ne pas modifier les sources pendant une campagne : le redémarrage automatique de l'API peut interrompre une opération réelle.

Les 35 tests d'intégration PostgreSQL réinitialisent uniquement la base dédiée indiquée par `TEST_DATABASE_URL`, dont le nom doit finir par `_test` et être distinct du nom de base de développement. Ne jamais y fournir une base contenant des données à conserver. En l'absence de cette configuration, ces tests sont explicitement skipped ; ce résultat ne valide pas le stock. `setup:local` crée `climbed_test` et le fichier de configuration local nécessaire.

Les tests Playwright utilisent les comptes fictifs, restaurent les scènes et compensent uniquement les réservations créées par leur scénario. Une interruption de processus pendant la campagne peut laisser une réservation à résoudre explicitement ; elle n'autorise pas une réinitialisation globale.

Chromium système est utilisé s'il existe à `/usr/bin/chromium`. Sinon, installer le navigateur correspondant avec `npx playwright install chromium`, ou renseigner `CHROMIUM_PATH`. Les rapports sont dans `playwright-report/` et les traces/captures dans `test-results/`, tous ignorés par Git. Le POC est vérifié sous Chromium ; Firefox, Safari et Windows restent à tester.

## Recette des corrections

La suite Vitest comprend 25 cas de géométrie, 19 d’historique local et de copie de sélection, 6 de planification pure et 27 d’intégration PostgreSQL. Les ajouts couvrent contacts et contenance, cavités réellement vides, collisions entre pans, empreintes d’appui, scènes anciennes, assemblage 0°/30°/0°, intégrité des sauvegardes, restaurations atomiques et copie profonde de hiérarchies.

Les nouveaux parcours Playwright vérifient le catalogue séparé sans perte du brouillon, les quantités et leur déclaration explicite, l’absence de personnalisation d’un placement, le vrai masquage WebGL de volumes partagés, les champs de toit, le refus de collision et l’historique depuis l’interface. Un contrôle conserve des coordonnées non arrondies après simple focus puis sortie d’un champ, sans édition.

Pour cette campagne, le serveur web/API a été démarré sans watch sur le port 3002, avec `DATABASE_URL` visant la base **distincte** `climbed_e2e_test`, préalablement migrée et alimentée avec les seules fixtures. La commande était :

```sh
WEB_BASE_URL=http://127.0.0.1:3002 API_BASE_URL=http://127.0.0.1:3002/api/v1 npm run test:e2e
```

Ces deux variables choisissent les endpoints des tests ; elles ne changent pas la base utilisée par un serveur déjà démarré. Ne pas exécuter deux campagnes simultanées contre les mêmes salles. Les contextes HTTP de test réutilisent des sessions réelles conservées uniquement en mémoire du worker afin de respecter la limite de connexion ; les modes de connexion des parcours navigateur sont précisés ci-dessous.

## Catalogue, raccourcis et diagnostics

Quatorze cas supplémentaires du noyau testent la copie des pans et objets, les identifiants et ouvertures distincts, les coordonnées locales des descendants, les décalages orientés, les associations de voies et l’absence de mutation de la source. Les refus couvrent collision, empreinte invalide, modèle ou support supprimé et limite des départs/arrivées.

Sept nouveaux scénarios navigateur vérifient les onglets et la recherche combinée du catalogue, l’entrée unique par le menu latéral, Suppr et Retour arrière, les copies au clavier avec descendants et contrôle du stock, les raccourcis natifs des champs, la limite de pans et l’affichage de plusieurs collisions dans l’assistant. La recherche de couleur porte sur le code hexadécimal réellement stocké ; les filtres détaillés et noms de couleurs restent à spécifier.

Les dix parcours navigateur antérieurs conservent leur connexion par formulaire. Les sept nouveaux utilisent l’option explicite `reuseSession` du helper : ils reprennent dans le navigateur une session obtenue par une vraie connexion HTTP, en mémoire seulement, pour respecter la limite des tentatives de connexion sans dérogation serveur. Les assertions de géométrie, de stock et de persistance ne sont pas simulées.

## Sélection multiple, niveaux et montage

La suite courante comprend **123 tests Vitest** : 55 géométrie/disposition, 27 commandes et historique local, 6 planification et 35 intégrations PostgreSQL. Les nouveaux cas utilisent de vrais rayons traversant les trous, le volume de matière retiré, des coordonnées de plan indépendantes et les transactions de sauvegarde/restauration. Les modèles hérités et leurs empreintes sont comparés avant et après utilisation des valeurs inférées.

Sept scénarios Playwright supplémentaires couvrent la sélection Ctrl sur les vrais meshes, la suppression de voie et les pièces partagées, le plan en U, les niveaux et escaliers persistés, les aperçus de placement valides et invalides, le refus atomique HTTP et le clic au centre d’un insert de volume lorsque la grille est masquée.

La campagne utilise une base **jetable dédiée** `climbed_e2e_test`, différente de `climbed_test` et de la base de développement. Pour les nouveaux tests, les fixtures de cette seule base démarrent avec les murs et modèles de démonstration mais sans placements : les anciennes ancres hors trame ne peuvent pas être supprimées puis réintroduites comme des ancres nouvelles. Les routes initiales y conservent leurs attributs mais ont `placementIds: []`, `startIds: []`, `finishId: null`. Cette préparation concerne exclusivement les fixtures de test ; `setup:local` conserve toujours les scènes et placements de développement. Le serveur de cette campagne est compilé, sans watch, avec `API_PORT=3002` et `DATABASE_URL` visant cette base. Ne pas lancer cette campagne sur une salle de travail.

Résultat final de cette campagne : **35/35 réussis en 2,6 min**, dont 12 parcours HTTP et 23 parcours navigateur, aucun skip. Les 28 scénarios antérieurs sont conservés.

## Profils prépercés et déplacements du dernier complément

La suite Vitest courante contient **135 tests** : 66 géométrie/disposition, 27 commandes/historique local, 6 planification et 36 intégrations PostgreSQL. Les cas supplémentaires vérifient le dôme hors alignement, une ou deux vis seulement, la distinction pilote/insert, le vissage direct explicite, la vis antirotation, les quatre boulons des exemples, une prise sur l’insert incliné de la pyramide et les translations des pans et sols. Le refus serveur vérifie l’absence d’écriture partielle.

Les tests antérieurs portant sur stock, collisions et hiérarchie utilisent désormais des profils de vissage direct **explicitement déclarés dans leurs fixtures**. Leur catalogue et leurs exemplaires sont créés ensemble avec les mêmes empreintes, dans la base de test. Les tests du mode prépercé utilisent des profils distincts et ne bénéficient pas de ce mode direct. Le seed ordinaire conserve les modèles historiques sans changement ; les salles de développement ne reçoivent pas ces fixtures.

La préparation reproductible est `npm run test:e2e:prepare`, après la préparation locale et la compilation. Elle crée par défaut `climbed_fixings_e2e_test`, base distincte de développement et de `climbed_test`, avec trois salles de fixtures sans placements initiaux. Une base préexistante avec un catalogue incompatible ou des placements est refusée, sans réinitialisation de ses scènes. Une URL différente peut être fournie via `E2E_DATABASE_URL` ; son nom doit finir par `_e2e_test` et être différent de la base de développement.

Démarrer ensuite le serveur compilé sur 3002 **avec cette URL comme `DATABASE_URL`**. Exemple depuis un terminal Linux à la racine du dépôt, en réutilisant les identifiants locaux sans les afficher :

```sh
node --env-file=.env --input-type=module - <<'JS'
import { spawn } from 'node:child_process';
const url = new URL(process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL);
if (!process.env.E2E_DATABASE_URL) url.pathname = '/climbed_fixings_e2e_test';
const server = spawn('npm', ['start'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url.toString(), API_PORT: '3002' },
});
server.on('exit', code => { process.exitCode = code ?? 1; });
JS
```

Dans le second terminal :

```sh
WEB_BASE_URL=http://127.0.0.1:3002 API_BASE_URL=http://127.0.0.1:3002/api/v1 npm run test:e2e
```

Trois nouveaux parcours UI complètent les 35 précédents : déplacement global et annulation, protection des champs et minimap sans sol ; dôme à quatre trous pilotes avec aperçu rouge/vert et refus HTTP partiel ; exemple de pyramide créé depuis le catalogue et vraie pose WebGL d’une prise sur un insert incliné. La capture de cette pyramide est une preuve du modèle synthétique, pas une image de produit fabricant.

Campagne finale : **38/38 réussis en 3,0 min**, aucun skip. Le nettoyage n’agit que sur les modèles créés par le scénario ; les stocks historiques de la fixture restent protégés. La préparation contrôle les quantités initiales attendues et l’absence d’occupations actives.


## Modes de montage et préparation explicite

Les neuf tests de `packages/geometry/tests/support-preparation.test.ts` couvrent permission, diamètre, pilotes réutilisés, trous sur bords/ouvertures, recouvrement d’inserts, exemplaire de volume isolé avec vrai perçage, autorisation produit et modification de pièce. Les intégrations PostgreSQL ajoutent trois cas d’atomicité, refus sans effets partiels et verrouillage après mise en stock.

`tests/e2e/preparation.spec.ts` ajoute trois parcours Chromium : catalogue et autorisation des trous de pièce ; préparation/pose d’un dôme, annulation atomique et persistance ; prise vissée sur un exemplaire de volume préparé. Les scènes d’origine sont restaurées et seul le stock créé par le scénario est retiré. Les anciennes définitions ne sont pas réécrites pour assouplir les règles.

Campagne navigateur finale de ce complément : **41/41 réussis en 3,3 min**, aucun skip, dont 12 parcours HTTP et 29 parcours Chromium avec WebGL. Les 38 scénarios précédents passent avec les trois nouveaux.
