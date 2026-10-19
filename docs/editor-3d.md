# Architecture proposée de l’éditeur 3D Climbed

Statut : proposition à valider avant implémentation. Ce document décrit des contrats et des choix d’architecture ; aucune fonction applicative n’est implémentée à ce stade.

## Objectif et périmètre

L’éditeur doit permettre à un ouvreur de concevoir une zone de bloc sur laptop : construire des pans, ajouter des volumes, placer des prises par clic répété, composer des blocs et sauvegarder son travail. La conception reste possible sans posséder les éléments utilisés. Les vérifications de stock interviennent dans le parcours de réservation, distinct du calcul géométrique.

L’ordre de construction V1 est **mur → volume → prises**, avec également des prises directement sur le mur. Un volume ne peut être placé que sur un mur. L’abstraction de support permettra d’étudier plus tard d’autres relations, mais cette généralité n’autorise aucun empilement en V1.

Les modèles 3D scannés ou modélisés extérieurement sont une exigence de compatibilité V2. La V1 prépare leur contrat de données sans livrer de fonction de scan ni de chaîne d’import complète.

## Architecture logicielle

Le socle proposé est React et TypeScript avec Vite pour l’application, Three.js avec React Three Fiber pour la scène et Drei pour les outils de visualisation appropriés. Le choix des versions sera fixé lors de l’initialisation technique.

Quatre responsabilités sont séparées :

| Responsabilité | Contenu |
| --- | --- |
| Document métier | Pans, occurrences de volumes et prises, supports, blocs, références de modèles et versions. |
| Géométrie et contraintes | Calculs TypeScript indépendants de React : contours, repères, projections, validité, génération des formes paramétriques. |
| Interaction | Sélection, outils, aperçu de placement, commandes, historique local et état de sauvegarde. |
| Rendu | Objets Three.js, matériaux, caches, instanciation, sélection visuelle et qualité d’affichage. |

La référence autoritaire est un **document JSON paramétrique versionné**, avec des références vers les versions d’assets externes. Le maillage produit pour l’écran est un résultat calculé ; il ne devient pas la source des dimensions ou des relations métier. Les calculs coûteux passent dans un Web Worker lorsque les mesures le justifient. Un résultat asynchrone porte la révision du document qui l’a demandé et est écarté si cette révision n’est plus courante.

## Repères et identité

- L’unité interne est le mètre. L’interface peut afficher et saisir des millimètres ou centimètres avec conversion explicite.
- Le monde utilise l’axe Y vers le haut. Les rotations sont stockées sous une forme sans ambiguïté, par exemple des quaternions normalisés ; les angles lisibles restent des paramètres d’interface.
- Chaque pan et chaque version de modèle possède son propre repère. Chaque surface de placement possède un identifiant stable et un repère local défini dans le modèle.
- Une occurrence possède son propre identifiant, une référence exacte au modèle et à sa version, un support et une pose locale. Sa pose mondiale se déduit de la chaîne des transformations.
- Le déplacement d’un volume déplace ses prises enfants. Le déplacement d’un pan déplace les éléments qui lui sont attachés.
- Une relation de support forme un graphe sans cycle. Les catégories autorisées sont vérifiées indépendamment du rendu.

Les indices de sommets, de faces ou de triangles d’un maillage ne sont jamais des identifiants métier. Une nouvelle triangulation ou un niveau de détail différent pourrait les modifier.

La pose inclut un point d’ancrage et une orientation relativement au support. Le modèle fournit aussi un repère de montage : position de contact, axe de fixation lorsque connu et orientation de référence. La normale utilisée pour proposer une pose ne suffit pas à déclarer une fixation physiquement compatible.

## Pans et ouvertures

Un pan est initialement une surface plane polygonale paramétrique, définie par son contour local, son épaisseur, ses ouvertures et sa transformation. Les outils créent des pans verticaux, en dévers ou en toit à partir de dimensions et d’angles. Ils permettent ensuite d’ajuster les sommets dans le plan et de composer plusieurs pans.

Déplacer un sommet hors du plan ne transforme pas implicitement le pan en surface libre. L’interface propose de scinder la forme en pans plans ou refuse l’opération. Les raccords doivent être explicites : une liaison peut maintenir une arête commune lors d’une modification ; un simple voisinage visuel ne crée pas cette liaison.

Deux concepts restent distincts :

1. **Fixations** : trame d’inserts ou points individuels décrivant des possibilités de montage. Elles sont des données et des marqueurs, sans perçage détaillé du maillage pour chaque insert.
2. **Ouvertures traversantes** : vrais trous rectangulaires, circulaires ou polygonaux dans le pan.

Pour les ouvertures d’un pan plan, la représentation est un contour 2D extérieur avec contours de trous, puis triangulation et extrusion de l’épaisseur. Le cercle est approché avec une précision contrôlée. Un moteur CSG général n’est pas requis pour cette fonction.

Le validateur vérifie la planéité, les contours simples, les auto-intersections, la validité et l’inclusion des trous, l’absence d’intersection entre trous, les dimensions et les dégénérescences selon des tolérances définies. Une ouverture touchant le contour devient une modification du contour ; elle ne passe pas silencieusement comme un trou intérieur. Une géométrie invalide ne remplace pas la dernière version valide du document.

Les opérations booléennes sur des volumes arbitraires ou des maillages importés sortent du POC. Si elles deviennent nécessaires, un prototype technique devra mesurer la robustesse, les coûts et la préservation des supports avant de choisir une bibliothèque CSG.

## Bibliothèque paramétrique et fixations

Le POC propose des familles de volumes réglables : boîte, prisme, pyramide, dôme et forme creuse. Chaque famille possède un schéma de paramètres et une version de générateur. Une forme creuse est représentée par une géométrie réellement concave, incluant les surfaces nécessaires ; une texture sombre ne simule pas la cavité.

Les modèles de prises et volumes portent séparément : géométrie, dimensions, matériaux d’affichage, surfaces de contact, surfaces pouvant recevoir des prises et données de fixation lorsqu’elles sont connues. Une surface visible n’est pas automatiquement une surface de montage autorisée.

La bibliothèque est partagée entre les salles d’un client. Une occurrence de conception référence un modèle ; elle ne référence pas obligatoirement un exemplaire physique tant qu’elle reste théorique. Plusieurs blocs peuvent référencer la même occurrence de prise sans créer plusieurs objets physiques.

Les filetages, espacements, dimensions et compatibilités fabricant sont **à documenter**. Aucun standard mécanique n’est supposé ici : les recherches fabricant précédentes étaient bloquées par une réponse proxy 403. Les champs inconnus gardent cet état et ne sont pas remplacés par une valeur réputée universelle. Les modèles génériques du POC sont des outils de conception, pas des pièces certifiées pour construction.

## Placement et ergonomie

Le parcours principal est : choisir un modèle → survoler une surface → voir un aperçu → cliquer pour poser → continuer à poser le même modèle. Échap quitte l’outil. La rotation est ajustable rapidement, avec saisie précise disponible. Les interactions de caméra restent distinctes des gestes de placement et de manipulation.

L’aperçu indique le support visé et les raisons d’un placement invalide. Le placement prend en compte le repère de montage du modèle et la normale de la surface, puis laisse régler l’orientation. L’accrochage à une fixation existante et le placement libre sont des options explicites ; le placement libre reste disponible en conception théorique.

Sur les surfaces courbes autorisées, le point choisi et le repère local doivent être conservés de façon reproductible. En V1, le générateur paramétrique fournit une représentation de surface exploitable. La V2 devra définir la projection et la réévaluation des attaches pour chaque version de mesh ; un simple indice de triangle ne suffira pas.

Les états de validation distinguent :

- géométrie impossible ou document incohérent, qui bloque l’opération ;
- collision ou pénétration détectée, à qualifier visuellement selon les formes et tolérances ;
- fixation inconnue ou non renseignée ;
- disponibilité physique, traitée par le service de stock.

Un test de collision n’est pas une validation mécanique. L’éditeur ne déduit pas la capacité portante, la résistance, la sécurité d’installation ou la conformité d’un montage à partir d’un mesh. Les intersections liées au montage et les creux demandent des règles spécifiques ; une boîte englobante seule n’est pas une preuve de collision réelle.

## Contrats du document et de l’API

Ces contrats sont conceptuels et doivent être affinés avec le modèle de données global avant l’implémentation.

| Contrat | Données et garantie |
| --- | --- |
| Version de modèle | Identifiant immuable, type de source, dimensions, repère, géométrie ou paramètres, surfaces, montage et métadonnées de provenance. |
| Occurrence | Identifiant stable, référence exacte de version de modèle, support, pose locale et paramètres spécifiques autorisés. |
| Document de scène | Version de schéma, unités, repère mondial, pans, occurrences, relations de support, blocs et révision métier. |
| Charger un projet | Document complet ou version demandée, révision courante et droits applicables. |
| Sauvegarder | Nouvelle représentation du document avec révision de base et identifiant de requête ; conflit explicite si la base a changé. |
| Valider | Résultats géométriques et métier structurés, avec objets concernés, sévérité et règle ; l’autorisation et les validations serveur restent nécessaires. |
| Réserver une version | Référence à une version persistée et aux besoins physiques dérivés ; le serveur décide des réservations de manière atomique. |

Les données locales ne sont pas une preuve d’appartenance au client ni de disponibilité du stock. Le serveur vérifie l’accès au projet, à la salle, aux versions de modèles et aux assets associés.

Une réservation doit viser une version persistée explicite. Modifier ensuite le brouillon ne modifie ni la réservation ni la représentation de l’installation courante. Une demande de changement compare la cible à l'état réellement réservé/installé et aux confirmations déjà effectuées, pas uniquement à une ancienne version installée : une intervention partielle peut comporter des réservations actives et des retours encore dus. Le traitement appartient au service de réservation et d’installation.

## État local, sauvegarde et évolution des supports

L’état local sépare le document métier de l’état éphémère : sélection, caméra, outil, survol, aperçu et caches ne doivent pas provoquer de versions métier. Les préférences de vue peuvent être sauvegardées à part.

Les modifications passent par des commandes cohérentes : poser, déplacer, supprimer, modifier un pan ou attacher un élément. Une manipulation continue produit une seule entrée d’annulation à sa fin. Annuler/rétablir concerne le brouillon local ; cela n’annule pas une réservation, une installation ou une opération historique sur le serveur.

Les versions persistées sont immuables. Une sauvegarde utilise un contrôle de concurrence optimiste ; un conflit est montré à l’utilisateur sans écraser les modifications d’un autre ouvreur. L’édition collaborative simultanée du même document n’est pas requise pour le POC. Les opérations de stock restent protégées même lorsque les projets sont distincts.

Un placement reste attaché à la version exacte de son support ou de son modèle. Publier une nouvelle version de bibliothèque ne remplace pas les références existantes. Une migration vers une autre version est explicite et présente ses effets avant confirmation.

Lorsqu’un pan est modifié dans le brouillon, les attaches sont réévaluées : point encore dans le contour, hors des ouvertures, support existant et montage autorisé. Les suppressions de surfaces ou changements de topologie invalident les attaches concernées. L’éditeur affiche les éléments à réparer et conserve assez d’informations pour comprendre leur ancien placement. Il ne les rattache jamais silencieusement à la surface la plus proche. La version déjà installée reste accessible.

## Compatibilité V2 : modèles scannés et modèles externes

Une version de modèle possède une source explicite :

- **Paramétrique** : famille, paramètres et version du générateur, avec maillages dérivés en cache.
- **Mesh** : référence immuable à un asset validé, avec métadonnées d’échelle, axes et montage.

Le format canonique candidat est glTF 2.0, de préférence GLB pour un asset transportable. Sa validation technique devra couvrir les exports réellement retenus. Les fichiers passent par un adaptateur de stockage : répertoire persistant local au POC si des fixtures en ont besoin, stockage objet privé visé en exploitation V2. La base conserve les références, tailles, types, empreintes SHA-256, provenance et versions. Les assets propres à un client restent soumis aux mêmes droits que sa bibliothèque.

La chaîne V2 visée est : acquisition ou import → conservation de la source → contrôle du fichier → normalisation explicite des unités et axes → nettoyage/décimation → définition du montage et des surfaces autorisées → génération des niveaux de détail → publication d’une version de modèle. La prise en charge de formats source et leur conversion est un chantier futur, sans engagement de conversion universelle.

Cette ingestion future devra borner tailles, nombre de triangles, textures et temps de traitement, valider le contenu et les extensions, puis traiter les fichiers dans un contexte isolé. Les URI externes ne seront pas chargées arbitrairement par le serveur ni acceptées comme liens vers des ressources privées. Droits d'utilisation et provenance restent associés à la source. Cette description n'ajoute aucune fonction d'upload au POC.

Un scan ne révèle pas automatiquement les dimensions exactes, la face arrière, le filetage, la matière ou les surfaces sur lesquelles on peut fixer une prise. Une échelle de référence et une vérification humaine seront nécessaires. Les données de fixation et de contact seront enrichies manuellement si elles ne sont pas fournies par une source fiable.

La géométrie de rendu peut comporter plusieurs niveaux de détail, distincts de la représentation de support et de la géométrie utilisée pour le picking précis. Le changement de qualité visuelle ne doit pas déplacer les attaches. Les surfaces de montage disposent d’identités propres ; une correspondance vers le mesh d’une version peut être recalculée, sans faire des indices de triangles une identité durable.

Si les modèles externes deviennent disponibles avant le scan, ils emprunteront ce même contrat de mesh. Leur présence ne rendra pas automatiquement leur géométrie éditable comme une famille paramétrique. La sculpture libre n’est pas dans le POC.

## Performance sur laptop

Le budget de scène provisoire est de **20 pans, 30 volumes et 500 prises**. Il sert à construire un jeu d’essai représentatif ; il ne constitue pas une performance validée ni une estimation exacte de la photo. Le laptop de référence et son navigateur restent à identifier. Un objectif initial de navigation et manipulation à au moins 30 images par seconde sur cette machine sera mesuré et révisé si nécessaire.

Les moyens proposés sont :

- partage des géométries et matériaux entre occurrences du même modèle ;
- instanciation des prises identiques lorsque compatible avec la sélection, la couleur et les besoins de montage ;
- correspondance explicite entre l’identifiant d’instance du rendu et l’identifiant métier lors du picking ;
- précision des formes courbes réglée selon leur taille affichée et caches indexés par version et paramètres ;
- affichage des fixations selon le zoom et le mode, sans créer un objet complet par petit insert ;
- rendu à la demande lorsque la scène est immobile, résolution et effets visuels adaptés au matériel ;
- calculs lourds hors du thread d’interaction et suppression des résultats devenus obsolètes ;
- accélération BVH étudiée après mesure pour les meshes complexes, sans imposer ce coût au POC paramétrique.

Les mesures portent sur le temps de chargement, la navigation, le picking, la pose répétée, le déplacement d’un volume équipé, la modification d’un pan et les sauvegardes. Une scène dense ne doit pas accélérer en désactivant silencieusement les validations indispensables.

## Étapes de validation et risques

Avant de développer tout l’éditeur, une tranche technique devra vérifier :

1. Un pan paramétrique percé, triangulé et extrudé, avec cas invalides correctement refusés.
2. Des volumes convexes et concaves, des prises attachées, et le déplacement fidèle de toute la chaîne.
3. Le placement répété, la rotation, la sélection et l’annulation sur le budget de scène provisoire.
4. Une sauvegarde/relecture sans perte de repères, dimensions, identités ni références de versions.
5. La modification d’un support avec invalidation visible des attaches devenues impossibles.
6. Le contrat d’un modèle mesh illustré sur un exemple de données ou une fixture contrôlée, sans livrer de fonction d’import utilisateur.

Les risques principaux sont la robustesse des contours et ouvertures, l’identité des supports pendant les modifications, le rendu et le picking d’une scène dense, ainsi que l’écart entre la géométrie visible et les propriétés de fixation réellement documentées. Ils seront traités par des cas de validation ciblés et des mesures, plutôt que par l’ajout préalable d’un moteur de modélisation général.

Cette architecture garde le même document métier pour les formes paramétriques V1 et les assets mesh V2, tout en laissant l’acquisition par scan, le traitement de fichiers et l’enrichissement mécanique dans des chantiers identifiés.
