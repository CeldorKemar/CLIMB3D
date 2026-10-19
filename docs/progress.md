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

Points de retour locaux : `f545ab7` pour le cadrage/architecture documentaire et `c5bbaad` pour le premier POC. Un commit complémentaire conserve la correction et la validation du conteneur. Aucun push GitHub, hébergement public ou publication de l'environnement n'a été effectué. Les champs cloud install_script et start_skill sont enregistrés pour revue ; leur publication reste une action de l'utilisateur dans les paramètres de l'environnement.
