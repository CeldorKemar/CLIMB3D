# Avancement

## Phase 0 — cadrage

**État : validé par le porteur du projet.**

Le périmètre a été recentré sur la conception 3D de blocs, les organisations multisalles et un stock lié à la réalité terrain. Le check-in réserve avant retrait physique ; l’installation et les retours sont confirmés distinctement. Le POC utilise des modèles paramétriques ; V2 doit pouvoir ajouter des modèles scannés ou modélisés.

## Phase 1 — architecture

**État : direction acceptée pour réaliser le POC.** Le porteur du projet demande une pile courante, un hébergement simple et des couches remplaçables. Le paiement reste futur.

Travail réalisé :

- Cadrage validé consigné dans specifications.md.
- Architecture web/API/base modulaire et règles d’accès proposées.
- Contrat de géométrie versionnée pour paramétrique V1 et assets 3D V2.
- Modèle de données, réservations concurrentes et état installé séparé des projets.
- Stratégie de tests et critères de démonstration.
- Sources techniques et limites de la recherche fabricant consignées.

Contributions indépendantes : un agent architecture/données, un agent éditeur 3D et un agent QA ont produit leurs documents respectifs. L’agent principal a intégré et relu la proposition. Aucune de ces contributions ne constitue une implémentation ou une validation applicative.

## Vérifications de la phase documentaire

Les contrôles ci-dessous portent sur la documentation et les métadonnées techniques. Aucun test applicatif n’existe encore.

- Neuf documents Markdown contrôlés : douze liens locaux valides, blocs de code fermés et fins de fichiers correctes.
- `git diff --cached --check` exécuté sans erreur avant le commit documentaire.
- Métadonnées npm consultées : versions candidates et contraintes de runtime ; sélection proposée de Prisma/client 7.10.1 stables plutôt que du tag Prisma `latest` pointant vers une RC.
- Relecture indépendante QA : pas de blocage majeur constaté sur les invariants documentés ; une divergence de définition du delta a été corrigée pour utiliser l'état réservé/installé réel, y compris les interventions partielles.
- Relecture d'intégration : précisions sur les permissions client déjà validées, les assets futurs, les variantes physiques et l'ordre de traitement des retries idempotents.
- Les documents seuls seront conservés dans le premier commit local. Aucun push distant ni publication de l'environnement n'est effectué par cette phase.

## Limites identifiées lors de l'architecture

- Accès aux documents fabricants toujours bloqué au proxy ; aucune cote ou compatibilité certifiée.
- Compatibilité de la pile fondée sur métadonnées npm, sans installation ni build intégré.
- Aucun modèle paramétrique ni import GLB implémenté ; aucune performance mesurée.
- Aucun service, PostgreSQL, migration, sauvegarde ou restauration applicative démarré.
- Windows 11 et laptop de référence non testés.
- Hébergeur, email et exigences opérationnelles à préciser avant un pilote externe.

## Suite prévue après l'architecture

Après validation de l’architecture : créer le socle exécutable et un premier parcours 3D sauvegardé, puis l’élargir par petits lots validés. Les bibliothèques, accès et stocks doivent être testés avec plusieurs clients et salles avant un usage partagé. Les fonctions reportées ne sont pas autorisées par la seule présence de contrats d’extension dans cette architecture.

## Phase 2 — POC exécutable

**État : livré et vérifié sur l'instance actuelle ; validation utilisateur attendue.**

### Réalisation

- Workspace npm TypeScript, contrats validés par Zod, géométrie indépendante et historique d'édition réutilisable.
- Interface React en français, éditeur WebGL réel et modèles paramétriques distincts, dont coupelles concaves.
- Pans rectangulaires réglables en dimensions, position, inclinaison et orientation ; toit ; ouvertures rectangulaires réellement traversantes.
- Placement répété par clic, rotation et réglage de position ; prises attachées aux volumes ; déplacement d'un support entraînant ses enfants.
- Composition simple de blocs, départs et arrivée ; sauvegarde explicite, rechargement et protection contre les révisions concurrentes.
- Authentification par session opaque, CSRF et permissions par salle ; comptes fictifs locaux de plusieurs rôles et clients.
- API NestJS et PostgreSQL, migrations immuables vérifiées par empreinte, SQL paramétré derrière un port, règles de planification pures distinctes du SQL.
- Stock par exemplaire ; check-in limité aux pans choisis ; interventions parallèles sur pans distincts ; conflits de dernière pièce gérés atomiquement.
- Retrait en réserve, installation, annulation et retours confirmés ; modifications par différence et journal des opérations.
- Script de préparation locale non destructif et idempotent ; cible d'un seul conteneur web/API et PostgreSQL externe.

### Vérifications réellement exécutées

- `npm ci --no-audit --no-fund` : installation depuis le lockfile réussie.
- `npm run setup:local` : PostgreSQL sain, migrations et seed idempotent réussis ; salles existantes préservées.
- `npm run build` : tous les typechecks de workspaces et build web réussis.
- `npm test` : **41 tests réussis**, aucun échec ni skip sur l'instance préparée : 16 géométrie, 4 commandes/historique, 6 planification pure et 15 intégrations sur PostgreSQL réel dans une base dédiée.
- `GET /api/v1/health` : réponse 200 après requête SQL réelle ; `GET /` : interface compilée servie par le processus API sans Vite.
- Campagne Playwright finale sur l'interface compilée servie par l'API : **8 tests réussis en 48,7 s**, dont cinq API HTTP et trois parcours navigateur WebGL. Le cas de révision concurrente vérifie que l'action de stock ne permet pas d'écraser le travail d'un autre ouvreur.
- Contrôle fonctionnel ponctuel d'une scène de **20 pans, 30 volumes et 500 prises** : sauvegarde, chargement et rendu WebGL réussis sans erreur JavaScript ; données de la salle fictive restaurées ensuite. Ce contrôle utilise le rendu logiciel de Chromium et ne mesure pas la fluidité d'un laptop.
- Capture réelle de la scène de démonstration conservée dans docs/assets/poc-editor.png : trois pans, cinq volumes, trente-trois prises.
- Image Docker finale construite et démarrée en mode production avec une base PostgreSQL de contrôle séparée, sans données de démo. Migrations, santé SQL HTTP 200, interface HTML, asset JavaScript HTTP 200 et refus HTTP 401 sans session validés. Utilisateur système `node`, non privilégié. Le conteneur de contrôle a ensuite été arrêté et supprimé ; la base de développement et ses données ont été conservées.
- La garde de production a été vérifiée : connecter l'image à la base fictive de développement contenant les comptes de démonstration refuse le démarrage.
- Un premier démarrage de conteneur avait révélé l'absence du tsconfig racine dans l'image d'exécution ; la copie de ce fichier a été ajoutée puis le démarrage revalidé. Les couches de dépendances sont séparées des sources pour réutiliser les installations vérifiées lors des changements de code. Le problème DNS propre à BuildKit et le certificat proxy de préparation sont décrits dans hosting.md ; TLS et empreintes npm sont restés vérifiés.
- Instructions cloud `install_script` et `start_skill` enregistrées dans un brouillon. Ces instructions ont été exercées sur l'instance actuelle ; l'enregistrement ne vaut ni application, ni publication, ni validation dans une nouvelle tâche.

Des essais intermédiaires ont révélé et permis de corriger : un décalage visuel introduit dans les ancres persistées ; la confusion entre révision du brouillon et version renvoyée par une opération de stock ; des fixtures de tests devenues invalides après enrichissement de la scène de démo. Une campagne a aussi été interrompue par les rechargements automatiques de développement : la finale utilise la version compilée sans watch.

### Limites du premier lot

- Un document de conception courant par salle ; pas de liste de projets alternatifs ni d'interface de restauration historique pour le moment. Les versions de sauvegarde sont conservées en base.
- Pans rectangulaires ; édition libre des sommets, polygones et raccords contraints reportés aux lots suivants.
- Modèles paramétriques du document et presets de démo ; pas encore de CRUD central du catalogue partagé entre salles. Un modèle personnalisé n'est pas automatiquement un exemplaire physique disponible.
- Authentification et autorisations présentes, mais pas d'écrans complets superadmin, invitations ou gestion des équipes et correction d'inventaire. Approvisionnement initial par les fixtures locales.
- Le retour confirme ensemble démontage et retour physique. Lors d'une modification installée, le démontage des anciens éléments est confirmé avec l'installation des nouveaux ; les anciens restent indisponibles jusqu'à leur retour confirmé.
- Pas d'autosauvegarde, d'édition collaborative en temps réel, de scan/import, de paiement ni d'interface publique.
- Détection des ancres et des références invalides ; aucune validation mécanique, ni détection exhaustive des collisions et empreintes d'appui.
- Pas de mesure sur un vrai laptop, pas de validation Windows 11. Les tests navigateur avec rendu logiciel ne prouvent pas les performances GPU de la machine cible.
- Les notices fabricants restent inaccessibles au proxy ; les profils de fixation sont génériques. Aucun fournisseur d'hébergement, email ni paiement n'est connecté.

### Prochaine validation

Faire essayer les gestes de conception et le parcours de réservation au porteur du projet avant une nouvelle phase importante. Les priorités de la suite seront décidées à partir de cette recette, notamment l'ergonomie 3D, les formes de pans et le catalogue client. Le POC local ne doit pas être présenté comme un SaaS prêt à commercialiser.

Points de retour : `f545ab7` pour le cadrage/architecture, `c5bbaad` pour le premier POC et `b14b33b` pour le conteneur vérifié. Le POC a ensuite été poussé, avec l’accord explicite du porteur du projet, sur la branche GitHub `poc/climbed-3d` afin de fournir un véritable téléchargement ZIP. Aucun hébergement public ni publication de l’environnement n’a été effectué. Les champs cloud install_script et start_skill restent enregistrés pour revue dans les paramètres.

## Recette du POC — dix corrections demandées

**État : implémentation et vérifications terminées pour les points 1–5 et 7–10 ; recherche du point 6 bloquée par le proxy. Validation utilisateur de ce lot attendue.**

### Réalisation

- Collisions sur les solides triangulés, formes concaves et contenance, entre pièces et pans différents ; contacts avec son propre support autorisés. Contrôle de l’empreinte d’appui sur le pan. Refus local et serveur avant toute persistance.
- Ouverture des scènes anciennes sans réécriture ; avertissement sur les conflits hérités. Les changements ne peuvent pas introduire de nouveau contact ni déplacer une pièce en maintenant son conflit. Une restauration exige un document entièrement valide.
- Toits exprimés en profondeur et pans en longueur réelle, avec hauteur et profondeur projetées. Assistant de murs composés, segments raccordés de bas en haut, exemple 1 m à 0°, 1 m à 30°, 1 m à 0°. Recentrage automatique après ajout.
- Catalogue paramétrique séparé avec aperçu WebGL, création, modification, duplication et suppression de modèles inutilisés. Les modèles placés ou déjà inventoriés sont verrouillés ; leurs variantes ont un nouvel identifiant. Position et rotation restent modifiables dans la salle, sans redimensionner une pièce physique.
- Brouillon de salle et historique local conservés pendant les passages salle/catalogue. Les changements de modèles sont sauvegardés explicitement avec le projet.
- Voies multiples, prises et volumes associés à plusieurs voies, cases de visibilité et masquage réel du rendu ; les supports nécessaires aux enfants visibles restent affichés.
- Stock disponible sur chaque tuile, modèle indisponible grisé, refus du placement et de la duplication dépassant les quantités. Prise en compte des besoins dessinés et des occupations compatibles ; les retours en attente restent indisponibles. Navigation du stock regroupée à gauche et titre à droite.
- Déclaration explicite de quantité par administrateur ou responsable, auditée. Une diminution ne retire que des pièces libres et conserve leur histoire via `retired_at`.
- Historique persistant immuable à chaque sauvegarde de salle, reprise des anciennes révisions, états nommés de salle ou de voie. Restauration transactionnelle avec intégrité, autorisations, révision, idempotence, collision et disponibilité compatible. La fusion de voie conserve les autres voies et refuse une ressource partagée incompatible. Aucun mouvement physique n’est confirmé implicitement.
- Métadonnées facultatives de fixation et de provenance dans le contrat ; aucune cote fabricant supposée. Guide de mise à jour Windows conservant les données Docker.

### Vérifications exécutées

- `npm run setup:local` répété : migrations et seed idempotents, sans écraser les salles. Les révisions et quantités de placements des trois salles de développement sont restées identiques : 51/38, 20/38 et 3/10. Les 74 versions préexistantes ont été reprises dans l’historique par la migration additive.
- `npm test` : **63/63 réussis**, aucun skip ni échec : 25 géométrie, 5 historique local, 6 planification pure, 27 intégrations PostgreSQL réelles.
- `npm run build` après les corrections finales : contrôles TypeScript de tous les workspaces et build web réussis.
- Campagne finale Playwright : **21/21 réussis en 1,6 min**, 11 HTTP et 10 parcours navigateur Chromium avec WebGL. Base séparée `climbed_e2e_test`, serveur compilé sans watch sur 3002. La base de développement n’a pas servi aux mutations de cette campagne.
- Contrôles particuliers : création/édition/duplication/suppression de modèles, brouillon conservé sans sauvegarde, stock 0 et déclaration de quantité, voies partagées et masquage WebGL, segments raccordés et toit, refus des collisions, restauration via l’interface, pénurie, ressource partagée modifiée, révisions concurrentes et isolation. Un focus/sortie de champ conserve désormais une position non arrondie sans créer de modification.
- Mesure ponctuelle Node sur 20 pans, 30 volumes et 500 prises : vérification de changement initialement autour de 1,3 s, puis autour de 20–34 ms à chaud après caches bornés des empreintes, réutilisation des boîtes de géométrie et mémoïsation des poses pendant l’opération. Ce n’est pas un benchmark GPU ni une mesure Windows.
- Serveur habituel sur 3001 redémarré : santé SQL HTTP 200, connexion et consultation des deux éditeurs sans mutation de scène ni erreur JavaScript. Captures actuelles dans `docs/assets/poc-editor.png` et `docs/assets/poc-catalog.png`. Le serveur de test a été arrêté après la campagne. Aucun déploiement externe effectué.

### Limites et blocage documentaire

- **Point 6 incomplet :** sites fabricants, chemin candidat de PDF officiel, forums et recherche web renvoient `Tunnel connection failed: 403 Forbidden` au proxy. Aucune fiche réelle n’a été lue. Les tentatives, URLs et limites figurent dans [research.md](research.md). Il faut un accès réseau effectif ou des catalogues fournis pour renseigner des profils vérifiés ; les métadonnées seules ne remplacent pas ces preuves.
- Catalogue du projet de salle, sans partage central entre les salles du client pour le moment. Éditeur sommaire limité aux familles paramétriques existantes ; ni sculpture libre, ni scan/import V2.
- Pans rectangulaires et raccords créés à l’assemblage ; pas de solveur maintenant les arêtes communes après une retouche isolée. Le contour complet d’appui d’une prise sur un volume courbe n’est pas vérifié ; la détection ne certifie aucune fixation mécanique.
- Historique listant les 200 dernières sauvegardes ; les anciennes restent en base. Une restauration de conception ne remplace pas une sauvegarde PostgreSQL contre la perte du volume.
- L’interface bloque les nouveaux ajouts indisponibles ; l’API de conception conserve la possibilité technique de sauvegarder une scène théorique dépassant le stock. Réservation et restauration vérifient obligatoirement la faisabilité physique côté serveur.
- Bundle de l’atelier toujours supérieur au seuil d’avertissement Vite : environ 1,066 Mo brut et 283 ko gzip. Windows, Firefox, Safari et fluidité sur un vrai laptop restent à vérifier. L’image Docker n’a pas été reconstruite pour ce lot ; sa précédente validation ne remplace pas ce contrôle ultérieur.

Ce lot est livré sur la branche du POC. Le point de retour avant ces changements reste `b14b33b`. La suite de la V1 demeure soumise à la recette et à la validation du porteur du projet.

## Complément de recette — catalogue, clavier et fixations

**État : points 1, 2, 4 et 5 implémentés et vérifiés ; point 3 documenté provisoirement, sources professionnelles encore inaccessibles et décision de placement attendue.**

- Deux onglets du catalogue de projet, prises et volumes, avec recherche commune extensible par nom, forme, code couleur enregistré et dimensions. Les futurs filtres détaillés restent à définir. L’éditeur de modèles n’est accessible que par l’icône du menu latéral principal ; les raccourcis d’accès de palette et de propriétés ont été retirés.
- Suppr et Retour arrière suppriment la sélection de salle avec ses descendants et associations ; le dernier pan reste protégé. Ctrl+C/V copie et colle, Ctrl+D duplique, Ctrl+Z annule. Les copies possèdent de nouveaux identifiants, conservent les coordonnées des enfants et les associations aux voies existantes. Le stock et la géométrie sont contrôlés avant ajout atomique. Presse-papiers local à la salle, sans permission de presse-papiers système ; champs de saisie, catalogue et fenêtres modales préservent leurs interactions.
- L’assistant de murs multi-inclinaisons affiche toute la liste des contraintes refusées avec des noms lisibles, conserve le formulaire et n’ajoute aucun segment partiel. La limite de 100 pans explique le nombre existant, le nombre ajouté et le total obtenu.
- Une étude détaillée dans [fixations.md](fixations.md) distingue boulonnage sur insert existant, vissage dans une zone autorisée, anti-rotation, modification de produit et interfaces de réception des volumes. Elle explique le cas d’une pyramide creuse à arrière ouvert avec appuis plans et fixation périphérique possible. Ces principes généraux ne sont attribués à aucun produit sans notice consultée.

### Résultats réels

- `npm test` : **77/77 réussis**, aucun skip ni échec : 25 géométrie, 19 historique/copie locale, 6 planification pure et 27 intégrations PostgreSQL.
- `npm run build` final : tous les typechecks et la compilation web réussis. Avertissement Vite conservé : atelier d’environ 1,076 Mo brut et 287 ko gzip ; aucune nouvelle dépendance.
- Playwright final : **28/28 réussis en 2,0 min**, dont 11 HTTP et 17 parcours Chromium avec WebGL, sur la base séparée `climbed_e2e_test` et le serveur compilé 3002. Les 21 scénarios précédents sont conservés. Une première campagne avait obtenu 27/28 : elle a révélé une classification approximative de couleur, retirée au profit du code couleur enregistré ; les assertions de recherche sont conservées.
- Les nouveaux scénarios prouvent filtres combinés, navigation unique, suppression et annulation, conservation de hiérarchie et associations, refus de copie sans stock, raccourcis natifs et deux causes de collision distinctes dans l’assistant.
- Les trois salles de développement conservent leurs révisions et placements : 51/38, 20/38 et 3/10. Le moteur de réservation et les règles physiques de montage n’ont pas été modifiés.

### Recherche et décision restante

Nouvelle tentative réelle vers neuf destinations fabricant/PDF/forum le 19 octobre 2026 à 20:28:58 UTC : refus `Tunnel connection failed: 403 Forbidden` avant lecture ; témoin npm HTTP 200, TLS vérifié. Aucun extrait professionnel n’a été reçu et aucune dimension ou trame universelle n’est inventée. Les domaines supplémentaires ont été enregistrés dans un brouillon réseau ; son activation nécessite Enregistrer puis Publier dans les paramètres de l’environnement et un nouvel essai effectif. L’enregistrement seul ne débloque pas la session.

La proposition à décider est de séparer les fixations de l’objet et les points/surfaces récepteurs du support : placement boulonné sur insert avec rotation, placement vissé sur zone autorisée et information inconnue explicitement signalée. Aucun nouveau moteur de montage ni profil fabricant n’est activé avant cette décision et la lecture de documents exploitables. Les pyramides génériques du POC ne reproduisent pas encore des coques constructeur creuses.

Le point de retour avant ce complément est `221ee89`. La mise à jour reste sur `poc/climbed-3d`, sans déploiement public.

## Derniers retours — sélection multiple, voies, plan, niveaux et montage

### Réalisation

- Ctrl + clic gauche ajoute ou retire des pièces de la sélection. La sélection multiple affiche uniquement la suppression groupée ; les transformations et copies groupées sont désactivées. La suppression nettoie les descendants et les références de voies en une commande annulable.
- La suppression d’une voie propose de supprimer ses pièces exclusives. La confirmation annonce les pièces partagées et les volumes supports conservés. Cette modification de conception ne libère aucun stock physique.
- Minimap en bas à droite avec positions XZ réelles, inclinaison, orientation et épaisseur des pans ; masquage, agrandissement, filtrage par niveau et clic pour cadrer le pan en 3D. Le plan agrandi gère le focus, Tab et Échap.
- Sols finis, niveaux nommés avec altitude, rattachement des pans et escaliers droits. Changer l’altitude transporte les pans du niveau et conserve les ancres locales de leurs enfants. Sauvegarde, rechargement et historique conservent ces données.
- Perçages réels des modèles paramétriques, avec parois intérieures. Boulonnage sur inserts compatibles, vissage sur surface autorisée et vérification des fixations complémentaires. Aperçu vert ou rouge avec motifs, refus au clic et validation commune côté API. Un insert traversant de volume reste ciblable même sans afficher la grille.
- Compatibilité des anciens documents sans réécriture des modèles ou de leur empreinte d’inventaire. Les anciennes ancres inchangées sont conservées ; les nouvelles ancres, y compris celles réintroduites par restauration, respectent les fixations. Les copies de pièces sont accrochées à un insert compatible avant contrôle du changement entier.
- Restauration de voie : import du niveau requis lorsqu’il manque ; refus d’écraser un niveau incompatible utilisé par d’autres pans ou escaliers. Les escaliers courants sont préservés.

### Vérifications

- `npm test` : **123/123 réussis**, aucun skip : 55 géométrie et disposition, 27 commandes/historique/copie, 6 planification pure et 35 intégrations PostgreSQL réelles dans une base dédiée.
- `npm run build` : tous les typechecks et compilation web réussis. Aucune nouvelle dépendance. Atelier : environ 1,110 Mo brut, 297 ko gzip ; avertissement de taille Vite conservé.
- Playwright final : **35/35 réussis en 2,6 min**, sans skip, dont 12 parcours HTTP et 23 parcours Chromium avec WebGL. Les sept scénarios du nouveau lot passent avec les 28 précédents, contre une base distincte et un serveur compilé sans watch sur 3002.
- Les essais intermédiaires ont révélé puis permis de corriger l’empreinte de pan sans épaisseur dans la minimap, son empilement devant les fenêtres modales, le ciblage à travers un insert de volume et l’attente de dimensionnement initial du canvas dans les tests. La finale conserve toutes les assertions de comportement.
- Le serveur habituel 3001 a été redémarré avec les règles actuelles. Connexion, chargement de l’atelier et du panneau niveaux sans mutation ni erreur JavaScript. Captures actuelles : `docs/assets/poc-editor.png` et `docs/assets/poc-levels.png`.
- Les trois salles de développement conservent leurs révisions et placements : 51/38, 20/38 et 3/10. Aucune migration SQL nouvelle ni réinitialisation des données de développement.

### Limites actuelles

Les profils de fixation sont des exemples synthétiques. Les notices fournisseur restent inaccessibles et aucune nouvelle cote fabricant n’est revendiquée. L’éditeur de catalogue ne permet pas encore de saisir toutes les interfaces de montage détaillées ; le contrat les accepte pour les profils futurs. Les pyramides génériques ne reproduisent pas les coques creuses d’un produit constructeur.

L’interface de sol édite des rectangles et les escaliers sont droits ; aucune trémie automatique, raccord architectural ou vérification réglementaire n’est fournie. Les collisions entre pièces et pans restent contrôlées ; les sols et escaliers sont des éléments de disposition, sans solveur de collision architectural. Les essais Chromium à rendu logiciel ne valident pas la fluidité sur un laptop Windows réel.

Le point de retour avant ce lot est `50086c4`. La livraison reste sur `poc/climbed-3d`, sans déploiement externe. Les sections précédentes conservent les résultats historiques de chaque lot ; elles ne décrivent pas toutes les fonctions de cette révision.
