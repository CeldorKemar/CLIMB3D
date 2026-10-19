# Climbed — Proposition de modèle de données

Ce document conserve le modèle cible de phase 1 accepté comme direction du POC. Les noms d'entités restent conceptuels ; le schéma réel du premier lot est dans apps/api/migrations, et ses limites sont décrites dans [progress.md](progress.md). Il utilise des scènes JSONB versionnées et du SQL via pg, pas encore toutes les tables normalisées proposées ici ni Prisma.

Les interventions du POC sont limitées à une sélection de pans. Un conflit de périmètre empêche deux changements ouverts sur le même pan, tandis que les pans distincts peuvent être préparés en parallèle. Les transactions de stock restent brièvement sérialisées par salle ; aucun verrou humain global de salle n'est imposé.

## Décisions de cadrage retenues

### Ajouts du lot de recette

La migration additive `004_design_snapshots_and_inventory_retirement.sql` ajoute `design_snapshots` et reprend les révisions de `scene_versions` sans modifier les scènes de salle. Chaque sauvegarde ultérieure écrit sa révision et son entrée d’historique dans une transaction. Les entrées contiennent une scène JSONB entière, le périmètre salle/voie, le libellé, l’auteur, la révision source et une empreinte SHA-256 du contenu JSONB canonique. Un trigger refuse leur modification et suppression ordinaires. La liste présente les 200 dernières entrées ; les plus anciennes ne sont pas supprimées.

Les associations plusieurs-à-plusieurs des voies se trouvent dans les `boulders[].placementIds` du document JSONB versionné. Elles acceptent prises et volumes ; les départs et arrivées restent des prises. Un élément partagé ne crée qu’un placement et n’exige qu’un exemplaire physique. Ce stockage n’implémente pas encore toutes les tables normalisées du modèle cible ci-dessous.

La restauration utilise l’autorisation par salle, un verrou, une révision attendue et une clé d’idempotence. Elle vérifie l’intégrité de la sauvegarde, les références, les contacts, les modèles et le stock compatible avant toute écriture. Une voie est fusionnée en préservant les autres voies et leurs supports ; un objet partagé qui devrait être modifié provoque un refus. Le calcul peut conserver les pièces compatibles déjà affectées au même placement sans les compter deux fois ; les retours en attente restent indisponibles. Aucun état physique n’est réécrit par la restauration.

La déclaration de quantité possède sa commande API, un contrôle de rôle, une clé d’idempotence et un audit. Une diminution ne peut retirer que des exemplaires libres. `stock_items.retired_at` conserve les anciens exemplaires et leur historique sans les proposer à une réservation. Les modèles déjà inventoriés gardent leur définition : changer la géométrie exige un nouveau modèle.

- Un client est une organisation pouvant exploiter plusieurs salles. Les données des organisations sont isolées ; un accès à une organisation n'accorde pas implicitement accès à toutes ses salles.
- Les modèles de murs, prises et volumes constituent un catalogue partagé au sein du client. Le stock physique appartient à une salle.
- Les rôles sont superadmin fondateur, administrateur client, responsable de salle et ouvreur. La matrice détaillée d'actions reste à valider.
- La conception théorique ne consomme et ne réserve aucun stock. Le check-in réserve le matériel ; son retrait du stock et son installation sont des confirmations distinctes.
- Un matériel pris physiquement n'est pas libéré par la seule annulation informatique. Le checkout d'une installation ne rend le matériel disponible qu'après démontage et retour confirmés.
- Les modifications traitent des différences entre états. Une pièce conservée dans une installation conserve son occupation ; une pièce partagée entre plusieurs blocs n'est comptée qu'une fois.
- Le public, la facturation en ligne et le scan ne sont pas implémentés dans cette phase. Une future source mesh doit réutiliser modèle, exemplaire et placement.

Propositions techniques, distinctes de ces décisions métier : PostgreSQL et Prisma avec une API NestJS modulaire ; Prisma et son client stables `7.10.1` épinglés ensemble ; UUID, longueurs en mètres, repère droit Y vertical. Aucune version RC n'est retenue. L'authentification et l'isolation sont vérifiées avant tout usage multiutilisateur du prototype.

## Frontière de sécurité

Toutes les tables métier possèdent `org_id NOT NULL`, y compris les tables d'association, d'historique et d'opération. Les tables propres à une salle possèdent aussi `room_id NOT NULL`. Les utilisateurs et le rôle de superadmin appartiennent au niveau plateforme.

Chaque ressource métier a un UUID `id` et une unicité `(org_id, id)`. Chaque référence métier utilise une clé étrangère composée `(org_id, resource_id)` vers `(org_id, id)`. Une référence à une ressource de salle utilise, lorsque nécessaire, `(org_id, room_id, resource_id)` et une unicité correspondante sur la cible. Cela empêche notamment une installation de consommer le stock d'une autre salle par simple substitution d'UUID.

L'API détermine l'organisation et les salles accessibles à partir de l'utilisateur authentifié et de ses droits actifs. Une organisation choisie dans l'interface ou envoyée dans une requête n'est jamais une preuve d'autorisation. Tous les accès par identifiant, listes, exports, historiques et opérations utilisent ce même contexte. Une action du fondateur doit elle aussi cibler explicitement une organisation et produire une trace d'audit ; ses conditions d'accès aux données client restent à valider.

Option de défense supplémentaire pour une évolution à valider : RLS PostgreSQL sur les tables métier, en complément des autorisations de l'API. Si retenue, les variables de contexte seront définies localement à chaque transaction pour éviter une fuite via le pool de connexions. Le rôle applicatif ne devra pas disposer d'un contournement de ces politiques. La fondation proposée repose sur les clés étrangères composées et les autorisations serveur ; aucune RLS n'est présentée comme mise en place ou indispensable au premier prototype.

## Utilisateurs, organisations et salles

| Entité proposée | Données principales et règles |
| --- | --- |
| `User` | UUID plateforme, identité et état du compte ; aucune appartenance client implicite. Comptes et sessions internes proposés dans architecture.md ; aucun fournisseur externe requis pour le POC. |
| `PlatformRole` | Attribution du rôle superadmin, distincte des rôles clients. |
| `Organization` | Client, nom, état actif/suspendu et dates. La suspension ne supprime pas les données. |
| `OrganizationMembership` | Organisation, utilisateur, rôle administrateur client éventuel, état actif/invité/révoqué. Unicité organisation/utilisateur. |
| `Room` | Organisation, nom, état, `plan_revision` et `physical_revision` pour les écritures concurrentes. |
| `RoomMembership` | Organisation, salle, membre de l'organisation, rôle responsable ou ouvreur ; unicité salle/membre. L'accès et les actions autorisées restent explicites. |
| `Zone` | Organisation, salle, nom, ordre d'affichage, état. |

L'administrateur client gère toutes les salles de son client, conformément au cadrage. Les responsables et ouvreurs ont des droits explicitement attribués par salle ; l'appartenance à l'organisation ne suffit pas. La matrice proposée dans architecture.md précise les actions sensibles sans remettre en cause ce périmètre transversal validé.

La suppression fonctionnelle utilise en priorité l'archivage des objets référencés. Aucun `ON DELETE CASCADE` global depuis l'organisation ou la salle n'est proposé. La durée de conservation et la procédure d'effacement restent des décisions produit distinctes.

## Catalogue client et géométrie

| Entité proposée | Données principales et règles |
| --- | --- |
| `CatalogModel` | Organisation, famille `WALL`/`HOLD`/`VOLUME`, nom, catégorie, état et référence de version courante. |
| `GeometryVersion` | Organisation, modèle, numéro de version, version de schéma, source `PARAMETRIC`, paramètres JSONB, points de fixation, emprise et empreinte de contenu. Immuable après création. |
| `StockVariant` | Organisation, modèle, version géométrique, dimensions physiques, couleur, configuration de fixation et référence fabricant éventuelle. Identité physique stable pour les exemplaires qui le référencent. |
| `GeometryAsset` | Proposition de lien vers un artefact dérivé, empreinte et type de fichier. Les exports ou caches peuvent être régénérés ; ils ne remplacent pas les paramètres sources. |

Une version géométrique utilisée n'est jamais écrasée. Modifier un modèle produit une nouvelle version. Les placements existants continuent à référencer la précédente jusqu'à une migration explicite. Changer les dimensions d'un modèle ne change donc pas silencieusement les exemplaires déjà inventoriés.

La variante représente une combinaison réellement distincte de dimensions, couleur et fixation ; le modèle représente la forme réutilisable. Les champs recherchés et vérifiables restent relationnels. JSONB accueille les paramètres géométriques spécifiques et versionnés, sans remplacer les clés étrangères ni les contraintes de stock.

Le modèle de source prévoit un discriminant versionné `PARAMETRIC | MESH`, même si seule la branche paramétrique est créable au POC. Pour un futur mesh, l'asset source immuable remplace les paramètres comme source d'autorité ; les caches et LOD restent dérivés. Modifier librement l'échelle d'une prise théorique ne permet pas de réserver un exemplaire d'autres dimensions : la réservation exige une variante physique compatible. Une correction de géométrie d'une référence physique exige une nouvelle version et une migration explicite des données concernées.

### Convention géométrique proposée

- Les valeurs persistées utilisent le mètre, y compris pour les prises ; l'interface peut afficher millimètres ou centimètres.
- Repère global droit, Y vers le haut ; transformations explicites entre salle, pan, volume et placement.
- Proposition : coordonnées locales d'un pan dans son plan de construction, avec une normale d'appui explicite. Les placements sur une surface utilisent ce repère local plutôt que des coordonnées globales seules.
- Les rotations sont enregistrées par quaternion normalisé ; les angles affichés dans l'interface ne sont pas une seconde source de vérité.
- Contours, ouvertures, épaisseur et points de fixation restent paramétriques. Les géométries dérivées sont reconstruites avec une version de générateur identifiable.

Les valeurs doivent être finies ; les dimensions doivent être positives et les quaternions valides. La validité d'un polygone, d'une découpe, de l'appui d'une prise ou d'une collision relève aussi du service géométrique. Une contrainte SQL ne suffit pas à établir ces propriétés.

Les perçages de fixation, les ouvertures traversantes et les inserts sont des concepts distincts. Diamètres, filetages, espacements, distances aux bords et compatibilités doivent provenir d'un profil documenté ou de paramètres saisis. Aucune valeur fabricant ou normative non vérifiée n'est imposée dans ce modèle. Une éventuelle validation structurelle n'est pas couverte.

Pour la V2, une source `MESH` pourra ajouter des artefacts vérifiés, leur unité, leur repère, des ancres et une version de traitement. Il faudra conserver les mêmes relations modèle → exemplaire → placement. Ce point prépare l'évolution ; il n'autorise aucun import ni scan dans la V1.

## Salle, conception et versions immuables

| Entité proposée | Données principales et règles |
| --- | --- |
| `RoomPlan` | Organisation, salle, UUID stable du plan, référence à sa version courante, compteur de révision. |
| `PlanVersion` | Organisation, salle, plan, version précédente, auteur, date et message. Photographie immuable de la conception. |
| `WallInstance` | Identité stable d'un pan de la salle, zone et modèle éventuel. |
| `WallState` | Version de plan, pan, version géométrique et transformation. Unicité version/pan. |
| `AssemblyJoint` | Version de plan, deux pans, références d'arêtes et paramètres de liaison. Une modification doit revalider la liaison. |
| `Placement` | Identité stable d'un placement théorique de prise ou volume dans la salle. Aucun exemplaire physique requis. |
| `PlacementState` | Version de plan, placement, variante ou version de modèle, support, transformation locale et état de validité. Unicité version/placement. |
| `Opening` / `FixingPattern` | Paramètres versionnés associés à l'état d'un pan ; séparation entre découpe et réseau de fixations. |

Les références entre états d'une même version doivent empêcher d'attacher un placement à un pan absent de cette version. Une proposition de structure pour les supports est un identifiant de support typé, ou deux références exclusives `wall_state_id` et `parent_volume_placement_state_id` avec contrainte « exactement une ». Le choix SQL définitif sera arrêté après validation des cas de volumes supports.

Une prise sur un volume conserve une transformation relative à ce volume. Les supports ne peuvent pas former de cycle. Cette dernière propriété demande une validation transactionnelle ou une représentation hiérarchique spécifique, à choisir lors de l'implémentation. Déplacer un support recalcule les dépendances et marque les placements invalides au lieu de les supprimer.

Proposition à confirmer : une seule occupation physique d'un emplacement de salle, avec plusieurs conceptions théoriques possibles. La sélection du plan de référence pour l'exploitation doit être explicite ; elle ne se déduit pas de la dernière sauvegarde d'un brouillon.

L'annulation/rétablissement locale n'est pas l'historique serveur. Les versions serveur sont immuables. Restaurer une version crée une nouvelle version courante et ne rembobine ni le stock réel ni les actions physiques déjà confirmées.

## Blocs

| Entité proposée | Données principales et règles |
| --- | --- |
| `Boulder` | Organisation, salle, identité stable, nom et état courant. |
| `BoulderVersion` | Bloc, auteur/ouvreur, cotation, couleur, description, date d'ouverture et statut brouillon/publié/archivé. Version immuable. |
| `BoulderPlacement` | Version du bloc, placement de la même salle, rôle départ/arrivée/standard. Unicité version du bloc/placement. |

Plusieurs blocs peuvent référencer le même placement. Le besoin physique est l'union des placements concernés, jamais la somme des listes de prises des blocs. Retirer un bloc ne libère pas automatiquement une pièce encore utilisée par un autre bloc ou toujours installée.

Proposition technique : chaque `BoulderVersion` référence sa `PlanVersion`, et chaque association référence le `PlacementState` de cette même version. L'historique montre ainsi la configuration d'alors sans dépendre de la position actuelle des prises. Les contraintes composées vérifient client, salle et version ; une évolution de bloc et de scène est sauvegardée de façon cohérente.

## Stock physique et état réel

Chaque exemplaire reçoit un UUID, même si l'interface permet une entrée de stock en quantité. Cette granularité permet de garantir qu'une pièce physique n'est pas allouée deux fois. Les entrées par lot créent plusieurs exemplaires dans une transaction ; les codes imprimés ou QR restent une option à valider.

| Entité proposée | Données principales et règles |
| --- | --- |
| `PhysicalItem` | Organisation, salle propriétaire, variante, numéro interne facultatif, état de vie actif/hors service/retiré, état de garde physique, révision. |
| `ItemOccupation` | Organisation, salle, exemplaire, placement cible, phase et opération d'origine. Une seule occupation active par exemplaire. |
| `PhysicalInstallation` | Organisation, salle, exemplaire, placement, support/transformation réellement confirmés, dates d'installation et de démontage, acteurs. Les lignes clôturées constituent l'historique physique. |
| `InventoryOperation` | Organisation, salle, type check-in/modification/checkout/annulation/confirmation, version de plan demandée, état, acteur et dates. |
| `InventoryOperationLine` | Exemplaire ou besoin de variante, placement, action attendue, état avant/après et confirmations. Les lignes conservent le détail du delta. |
| `InventoryMovement` | Événement immuable de réservation, prise en stock, installation, démontage, retour ou compensation. Acteur, opération et horodatage obligatoires. |
| `ZoneInstallation` | Proposition de périmètre d'exploitation d'une zone : version planifiée de référence, état réel courant et révisions propres au périmètre. |

Proposition à valider : un seul change-set ouvert par installation de zone, matérialisé par une unicité conditionnelle sur l'opération non terminale de ce périmètre. Les personnes peuvent travailler sur des zones ou pans indépendants ; les sous-périmètres par pan restent à préciser si nécessaires pour éviter les chevauchements. Le verrou de stock de salle ci-dessous sérialise uniquement les courtes transactions d'allocation, pas toute la durée humaine d'une intervention. Les révisions d'exploitation par zone évitent de rejeter une intervention indépendante à cause d'un changement dans une autre zone ; une modification du catalogue ou d'un plan englobant doit vérifier explicitement ses dépendances.

La disponibilité est dérivée, pas un compteur éditable : exemplaire actif, confirmé au stockage et sans occupation active. Une quantité agrégée peut être mise en cache pour l'affichage ; elle ne décide jamais seule d'une réservation.

### États et confirmations

Proposition de représentation : `ItemOccupation.phase = ALLOCATED | INSTALLED | RETURN_PENDING`, séparée de l'état de garde du matériel (`IN_STORAGE | TAKEN | ON_WALL | REMOVED_AWAITING_RETURN`). Une occupation active reste présente pendant toute la séquence ; la clôture conserve son historique. `ALLOCATED` couvre aussi une pièce déjà retirée mais pas installée : une confirmation `withdrawn_at` et son acteur permettent de distinguer ce cas sans perdre sa réservation.

| Action | État et effet attendus |
| --- | --- |
| Conception ou sauvegarde d'un brouillon | Aucun effet sur le stock. |
| Check-in accepté | Création d'une occupation `ALLOCATED` pour les ajouts ; les pièces sont réservées mais encore au stockage. |
| Confirmation du retrait physique | Garde `TAKEN` ; la réservation subsiste. |
| Confirmation d'installation | Même occupation, phase `INSTALLED`, garde `ON_WALL` et création d'une installation réelle. |
| Annulation avant retrait | Clôture des allocations non retirées ; elles redeviennent disponibles. |
| Annulation après retrait | Compensation et retour à confirmer ; occupation conservée en `RETURN_PENDING`, aucune disponibilité anticipée. |
| Checkout demandé sur une installation | `RETURN_PENDING`, matériel encore indisponible. La demande ne prétend pas qu'il est démonté. |
| Démontage confirmé | Installation clôturée, garde `REMOVED_AWAITING_RETURN` ; occupation toujours active. |
| Retour confirmé au stockage | Garde `IN_STORAGE`, clôture d'occupation ; disponibilité si l'état de vie le permet. |

Les confirmations partielles par pièce sont une proposition à valider : elles reflètent un retour physique progressif, mais ne changent pas l'atomicité de la décision de réservation d'une opération. Une confirmation de retour exige une installation déjà démontée, ou une pièce retirée qui n'a jamais été installée. Un simple passage du statut d'opération à « annulée » ne supprime jamais les occupations.

## Deltas, atomicité et concurrence

Le calcul compare la cible demandée à l'état réservé/installé actuellement autorisé, et non à un ancien dessin supposé encore réel. Il sépare :

1. **Conservés** : placements et pièces déjà occupés, encore requis. Leur occupation est réutilisée, y compris si plusieurs blocs les référencent.
2. **Ajouts** : nouveaux besoins à satisfaire par des exemplaires réellement disponibles et compatibles.
3. **Retraits** : allocations inutilisées libérables si non retirées ; sinon retours ou démontages à confirmer.
4. **Déplacements** : même exemplaire, nouvelle position cible. L'occupation subsiste ; l'installation actuelle ne change qu'à confirmation de l'intervention réelle.

Une pièce installée et conservée ne fait jamais l'objet d'une seconde réservation. Une pièce à déplacer peut avoir un état réel et un état cible différents, mais conserve une seule occupation active. Le transfert vers un autre placement doit être représenté dans la même opération et ne peut pas être simulé par une libération anticipée.

### Transaction de réservation proposée avec Prisma

1. Authentifier et vérifier les droits de salle, puis ouvrir une transaction interactive Prisma. Vérifier à nouveau les droits utiles dans le contexte transactionnel si leur révocation peut entrer en concurrence.
2. Verrouiller la ligne du périmètre d'exploitation de la salle avec `SELECT ... FOR UPDATE` exécuté par les fonctions SQL paramétrées de Prisma. Proposition initiale : sérialiser les mutations de stock d'une même salle pour garder un protocole simple et démontrable.
3. Vérifier d'abord la clé d'idempotence : si le résultat de la même commande et du même contenu est déjà validé, le restituer après contrôle des droits actuels, sans comparer à nouveau une ancienne révision déjà consommée par cette commande. Pour une nouvelle commande, vérifier ensuite l'unique change-set ouvert du périmètre, la version du plan `expectedPlanRevision`, la révision physique du périmètre si requise et la version immuable visée. Une divergence rejette la demande avant toute mutation métier.
4. Calculer le delta ; charger les occupations existantes et choisir les exemplaires candidats. Verrouiller les exemplaires et occupations concernés dans un ordre déterministe par UUID avec `SELECT ... FOR UPDATE`. Toutes les écritures de stock, y compris retrait, retour et maintenance, suivent le même ordre de verrous : salle, puis exemplaires, puis occupations.
5. Recalculer et vérifier disponibilité, compatibilité, salle et absence d'occupation concurrente à partir des lignes verrouillées. Une pénurie rejette l'ensemble de la réservation ; aucune allocation partielle cachée.
6. Appliquer ajouts, conservations et sorties autorisées ; enregistrer l'opération, ses lignes, mouvements et audit dans la même transaction. Mettre à jour les compteurs de révision attendus par comparaison atomique.
7. Enregistrer le résultat d'idempotence et valider. En cas d'erreur, rollback intégral des mutations métier. Les actions physiques déjà confirmées lors d'opérations précédentes ne sont pas annulées par ce rollback.

Les opérations SQL brutes restent paramétrées ; aucun identifiant ou fragment SQL fourni par l'utilisateur n'est interpolé. Les lectures de disponibilité effectuées avant la transaction sont indicatives. Les transactions restent courtes et ne contiennent ni interaction humaine, ni appel réseau, ni calcul géométrique long.

L'ordre déterministe réduit les interblocages. Un éventuel retry est borné et réservé aux conflits transactionnels identifiés, avec la même clé d'idempotence. L'isolation de transaction et la stratégie exacte de retry seront établies et testées pendant l'implémentation ; l'isolation par défaut seule n'est pas une garantie suffisante.

### Idempotence

`IdempotencyRecord` porte au minimum organisation, salle, acteur, famille d'opération, clé fournie, empreinte canonique du contenu, état et référence du résultat. Une contrainte unique couvre ce périmètre et la clé. Deux salles ou deux acteurs ne partagent pas fortuitement leurs résultats.

- Même clé et même empreinte : restituer le résultat déjà produit, après autorisation actuelle, sans nouveau mouvement.
- Même clé et contenu différent : conflit explicite ; aucun nouvel effet métier.
- Requêtes simultanées : une seule obtient le droit d'exécuter ; les autres récupèrent le résultat validé ou un état de traitement défini.
- Les confirmations et compensations possèdent elles aussi une identité stable pour éviter un double retour ou un double démontage.

Le résultat d'une opération réussie, sa trace d'idempotence et ses mutations métier sont validés ensemble. La durée de conservation des clés et la restitution des échecs déterministes sont des propositions à préciser ; une éventuelle trace d'échec ne doit pas laisser de stock partiellement réservé.

### Annulation compensée

L'annulation vise une opération précise, vérifie ses révisions et crée des événements compensateurs. Elle ne supprime ni installations ni mouvements historiques. Les ajouts non retirés peuvent être libérés immédiatement ; les pièces prises restent dues au stock ; les pièces déjà installées exigent démontage et retour. Les occupations conservées provenant d'une installation précédente ne sont pas libérées par l'annulation d'un changement.

La restauration d'un plan ou d'une version de bloc utilise le même mécanisme de delta lorsqu'elle doit devenir physique. Elle ne « restaure » jamais une ancienne quantité en base.

## Contraintes de base à prévoir

- Clés étrangères composées d'organisation et, pour les ressources locales, de salle ; unicités correspondantes sur les cibles.
- Index unique partiel sur `ItemOccupation(org_id, physical_item_id)` pour les occupations actives, c'est-à-dire sans `closed_at`.
- Index unique partiel sur l'exemplaire d'une `PhysicalInstallation` non démontée ; proposition complémentaire sur un placement réellement occupé pour éviter deux pièces au même emplacement.
- Unicité d'une allocation active par placement cible ; un déplacement ne crée pas deux cibles simultanées hors opération explicitement modélisée.
- Unicité des numéros de versions par objet et des références bloc/placement par version.
- Valeurs de quantité positives pour les commandes par lot ; une pièce est indivisible.
- Contrôles de cohérence entre phase, garde, installation et clôture. Les invariants couvrant plusieurs tables nécessitent des transactions communes et, lorsque pertinent, des triggers SQL à spécifier.
- Refus de changer de salle, variante ou dimensions d'un exemplaire occupé par simple mise à jour. Transferts intersalles et correction d'inventaire sont des workflows à cadrer séparément.
- Retrait d'un exemplaire du stock actif soumis à absence d'occupation ou à une opération de résolution explicite ; aucune suppression silencieuse.

Les index partiels, politiques RLS, contraintes avancées et certains contrôles ne sont pas tous représentables dans le schéma Prisma selon la version retenue. Ils devront être créés dans des migrations SQL versionnées, revues et conservées avec les migrations Prisma. Ne pas compter sur une synchronisation automatique du seul schéma ORM pour les recréer.

## Audit, recherche et sauvegardes

`AuditEvent` conserve organisation, salle éventuelle, acteur, action, ressource, opération corrélée, date serveur et métadonnées utiles sans secret. Les mouvements de stock et les versions géométriques sont append-only du point de vue du rôle applicatif usuel. L'historique opérationnel de salle est distinct d'un futur historique de grimpeur.

Index prioritaires : organisation/salle/état pour les listes, salle/date pour l'audit et les mouvements, variante/salle pour les exemplaires, placement et exemplaire pour les occupations, objet/numéro pour les versions. Les index JSONB ne seront ajoutés qu'aux recherches réellement nécessaires.

Proposition d'exploitation : sauvegardes PostgreSQL régulières, sauvegarde cohérente des éventuels artefacts externes et exercice de restauration dans un environnement isolé. Rétention, objectifs de perte de données et délai de reprise restent à valider ; aucun dispositif de sauvegarde n'est déclaré opérationnel à ce stade.

## Scénarios de validation à implémenter ultérieurement

Ces scénarios décrivent des tests à écrire et exécuter après validation. Aucun n'a été exécuté dans cette phase documentaire.

- Un ouvreur d'une salle ne lit ni ne modifie une autre salle par substitution d'UUID ; les relations interorganisations sont rejetées en base.
- Deux demandes simultanées visant la dernière pièce disponible ne produisent qu'une occupation active.
- Une réservation impossible ne réserve aucune des autres pièces demandées et ne change pas les révisions métier.
- Une même pièce commune à deux blocs conserve une seule occupation ; archiver un seul bloc ne la libère pas.
- Modifier une installation en conservant une pièce ne demande aucun stock supplémentaire pour cette pièce.
- Un déplacement conserve l'occupation et l'installation réelle précédente jusqu'à confirmation.
- Annuler avant retrait libère ; annuler après retrait laisse un retour dû ; checkout sans retour confirmé ne rend pas disponible.
- Un retry idempotent ne reproduit aucun mouvement ; une clé réutilisée avec un contenu différent est rejetée.
- Une révision de plan obsolète est rejetée sans effet ; une restauration historique ne rembobine pas le stock physique.
- Modifier une géométrie conserve l'ancienne version et signale les placements devenus invalides.
- Sauvegarde et rechargement conservent unités, transformations, références de versions et associations entre blocs et prises.

## Points à valider avant le schéma détaillé

1. Permissions sensibles proposées, notamment accès de support du fondateur et correction d'inventaire. L'administration de toutes ses salles par l'admin client est déjà validée.
2. Périmètre du plan d'exploitation, coexistence des brouillons et portée des check-in/checkout : sélection de blocs, zone ou installation entière.
3. Gestion des confirmations partielles et traitement des pièces manquantes, abîmées, prises par erreur ou temporairement introuvables.
4. Réparation des attaches lors d'un changement de support. Prises sur volumes autorisés et absence de volumes sur volumes au POC sont déjà validées.
5. Proposition d'édition non collaborative en temps réel avec contrôle de révision ; variante de cotation à préciser avant le module blocs. Transferts intersalles reportés et références fabricant encore à documenter.

Ces points sont des décisions ouvertes, pas des fonctionnalités implicitement autorisées. Le modèle devra être ajusté après leurs réponses avant toute migration applicative.


## Extensions JSONB : niveaux et fixations

Le document versionné accepte `levels` (identifiant, nom, altitude, contour XZ), `stairs` (niveaux reliés, extrémités XZ, largeur, marches) et `walls[].levelId`. `mounting` décrit les trous propres des modèles ; `supportFixings` décrit les inserts et l’autorisation de vissage des pans et modèles supports. Ces ajouts sont facultatifs et ne nécessitent aucune nouvelle migration SQL. Les valeurs inférées pour les anciens modèles ne sont pas réécrites dans leur JSON, afin de conserver les empreintes d’inventaire.

La restauration de salle contrôle ces références et les ancres nouvellement réintroduites. Une restauration de voie importe le niveau manquant nécessaire à ses pans ; un niveau existant incompatible utilisé par un autre pan ou un escalier provoque un refus atomique. Les escaliers courants sont conservés. La suppression d’une voie et de ses pièces exclusives nettoie uniquement la conception ; les occupations de stock et interventions restent suivies séparément.
