# Prises, volumes et supports : fixation et conséquences pour Climbed

## Statut de cette étude

Ce document conserve l’étude provisoire des pratiques de fixation. La demande suivante du porteur du projet autorise désormais des trous visibles et un placement contraint dans le POC. Les exemples implémentés sont synthétiques ; aucune notice fabricant n’a été rendue accessible depuis cette étude.

Le 19 octobre 2026 à **18:32 UTC**, douze requêtes HTTPS vers des fabricants, un guide PDF candidat et des forums ont échoué au proxy avec `Tunnel connection failed: 403 Forbidden`. Aucun contenu technique de ces sites n'a été reçu. La requête témoin vers le registre npm a reçu HTTP 200. La vérification TLS est restée active ; aucun contournement du proxy n'a été utilisé.

Une nouvelle vérification, le **19 octobre 2026 à 20:28:58 UTC**, après la reprise demandée par l'utilisateur, donne le même résultat : les neuf requêtes vers Metolius (site et PDF candidat), Escape, Atomik, EP Climbing, Walltopia, Cheeta, Bluepill et Mountain Project sont refusées par le proxy. Le témoin npm reçoit HTTP 200. Preuve locale : `.data/research/fixations-20261019T202858Z/requests.json`. Le brouillon de domaines réseau enregistré auparavant n'a donc pas ouvert l'accès effectif dans cette instance. Une proposition enregistrée n'est pas une publication ; aucune source n'est requalifiée en source lue.

Il faut distinguer trois niveaux dans la suite :

- **Vérifié pendant cette recherche** : les résultats réseau et les champs existants du contrat logiciel lus dans le dépôt.
- **Connaissances générales provisoires** : les mécanismes décrits ci-dessous permettent de comprendre le métier, mais n'ont pas été recoupés avec une notice consultée pendant cette session. Ils ne constituent ni un mode opératoire de montage ni des caractéristiques attribuables à une marque.
- **À confirmer par référence** : les matériaux, fixations, points utilisables, compatibilités, quantités, dimensions, perçages et conditions de montage. La notice du fabricant du produit et celle du système de mur restent les documents de référence.

## Réponse aux questions métier

Les explications de cette section relèvent du niveau « connaissances générales provisoires ».

**Réponse courte : il faut prévoir deux familles de montage**, une pièce boulonnée sur un insert existant et une pièce prévue pour être vissée dans une surface autorisée. Par conséquent, imposer à toutes les prises et tous les volumes un alignement sur une grille unique risquerait d'exclure des montages réellement possibles. À l'inverse, permettre tout placement sur toute surface ne décrirait pas les restrictions d'une référence physique. Cette distinction doit être confirmée par les notices des produits retenus avant de contraindre l'éditeur.

### Les ouvreurs utilisent-ils des trous et inserts existants ?

Un cas de fonctionnement est le panneau équipé de points filetés préparés à l'avance. Le boulon traverse un passage prévu dans la prise et se visse dans un écrou à frapper ou un autre insert du système de panneau. Le serrage maintient la prise contre son support. Le trou du panneau, le passage dans la prise et le filetage de l'insert sont trois choses différentes.

Dans ce cas, l'ouvreur choisit parmi les points disponibles ; il ne crée pas nécessairement un nouveau perçage pour chaque prise. Les points peuvent suivre une trame ou un plan propre à la salle. Leur présence ne garantit pas qu'ils soient tous utilisables : accessibilité, détérioration, proximité d'un bord ou d'un assemblage et restrictions du constructeur restent des informations distinctes.

Une vis à bois fonctionne autrement : elle prend dans le matériau du support, au lieu d'utiliser le même couple boulon/insert fileté. Certaines prises et certains volumes sont conçus pour ce mode de fixation. La position peut alors être choisie en dehors des inserts, sous réserve des surfaces et conditions autorisées. « Placement hors de la trame » ne signifie donc pas « montage impossible », ni « perçage libre partout ».

### Ajoutent-ils des trous ou des vis dans le pan ?

Il faut distinguer plusieurs opérations :

| Opération | Sens métier | Conséquence pour la représentation |
| --- | --- | --- |
| Utiliser un insert existant | Boulonner une pièce sur un point déjà présent | Référencer un point de fixation du support |
| Poser une pièce prévue pour vissage | Employer ses trous prévus et des vis adaptées dans une zone de support autorisée | Conserver les points de vis de la pièce et leur position sur le support |
| Ajouter une fixation complémentaire prévue | Stabiliser une pièce selon ses dispositions de montage | Distinguer la fixation principale et les points complémentaires |
| Ajouter un nouvel insert ou modifier le panneau | Modifier l'équipement du support | Opération de construction/maintenance à autoriser séparément, sans la déduire d'un glisser-déposer |
| Percer un trou neuf dans une prise ou un volume | Modifier le produit | Aucune autorisation implicite ; vérifier une instruction explicite du fabricant |

Un trou ou une marque laissé par une vis n'est pas automatiquement un insert réutilisable, ni une fixation disponible. Un avant-trou éventuel, le choix d'une vis et l'état du support relèvent de la notice et du responsable du matériel. Aucune valeur de diamètre, de profondeur ou de distance au bord n'est déduite ici.

### À quoi sert la stabilisation contre la rotation ?

Une pièce peut nécessiter un point complémentaire pour limiter sa rotation autour de sa fixation principale. Lorsqu'une vis complémentaire est prévue, elle ne doit pas être confondue avec le boulon principal ni avec un droit de repercer la pièce à un endroit arbitraire.

L'application doit pouvoir distinguer : fixation principale, point anti-rotation prévu et point de fixation obligatoire supplémentaire. La présence, le nombre et le rôle des points doivent venir du produit ou d'une saisie explicitement qualifiée. Un boulon visible ne suffit pas pour conclure que tous les autres points sont facultatifs ; une vis visible ne suffit pas pour conclure que l'objet est un modèle exclusivement vissé.

### Peut-on fixer une prise sur un volume ?

Il faut d'abord connaître le volume considéré. Un produit peut offrir des inserts sur certaines faces, des surfaces prévues pour recevoir des prises vissées, une combinaison de ces possibilités, ou aucune de ces capacités. Une surface visible et suffisamment grande n'est pas, à elle seule, une autorisation de fixation.

Deux interfaces sont différentes : **comment le volume est fixé au mur**, et **comment une prise peut être fixée sur le volume**. Leurs emplacements, directions, matériels et règles peuvent être différents. La même distinction s'applique à un volume fixé sur un autre volume : ne pas autoriser systématiquement l'empilement à partir de la seule géométrie.

Les termes « volume » et « macro » décrivent des familles commerciales et des usages, mais ne doivent pas déterminer automatiquement la présence d'inserts, le matériau, le mode de fixation ou la capacité à porter d'autres objets. Ces capacités seront renseignées séparément.

### Les ouvreurs modifient-ils les prises ?

L'éditeur doit distinguer **créer un modèle paramétrique virtuel**, **personnaliser sa représentation** et **modifier un produit physique**. Ajouter virtuellement un trou à un modèle ne donne aucune instruction ni autorisation pour percer, fraiser ou agrandir le trou d'une prise réelle.

La V1 ne proposera pas de flux qui recommande de repercer arbitrairement une prise ou un volume. Une modification explicitement permise par un fabricant doit être traitée comme une instruction propre à cette référence, avec sa provenance ; l'absence de notice ne vaut pas permission.

## Grande pyramide creuse : ouverture arrière et surface d'appui

Cette section décrit un **cas conceptuel possible**, pas un produit photographié identifié ni une notice fabricant vérifiée.

Un gros volume pyramidal peut être construit comme une coque ou un assemblage de panneaux, avec un arrière ouvert. Sa forme extérieure est alors pyramidale, mais son intérieur n'est pas un bloc plein. Il peut ne pas exister de grande plaque fermant tout le polygone de base.

L'ouverture arrière et l'appui plan ne s'excluent pas : les chants, un rebord ou des zones d'appui peuvent se trouver dans un même plan, et ce sont ces zones qui rencontrent le mur. **Plan d'appui** ne signifie donc pas **face arrière entièrement remplie de matière**. Une autre référence peut avoir un arrière fermé ou des appuis différents ; la forme pyramidale seule ne permet pas de choisir.

Des trous de fixation peuvent se trouver près de la périphérie, dans des zones destinées à cet usage, afin de recevoir des vis vers le panneau support. Cela constitue une autre configuration qu'un objet maintenu par un boulon central. Ni l'une ni l'autre n'est universelle : certains produits peuvent comporter plusieurs systèmes ou des contraintes particulières.

Pour la géométrie, distinguer :

- L'enveloppe extérieure visible et l'épaisseur de la coque ou des panneaux.
- Le vide intérieur et l'ouverture arrière, lorsqu'ils existent.
- Le plan de référence et les zones réelles d'appui.
- Les points et axes de fixation du volume sur le mur.
- Les points ou surfaces autorisés à recevoir d'autres prises.

Fermer automatiquement la base par une plaque pleine peut fausser la vue arrière et l'analyse des contacts. À l'inverse, supprimer une face du maillage sans représenter l'épaisseur ne décrit pas nécessairement le matériau du produit. Un futur profil géométrique de coque devra définir explicitement extérieur, intérieur et bord de l'ouverture. Un maillage de collision, un maillage visuel et les zones d'appui peuvent avoir des représentations différentes, documentées.

## Coordonnées, contact et placement

Une cote locale `0` est un choix de repère logiciel. Elle ne représente pas universellement la face du mur, le centre de la prise, sa base ou son trou de fixation.

Chaque support doit définir un repère local, ses surfaces et leurs normales. Chaque objet à poser doit définir un repère d'attache, son orientation et, lorsque connu, son plan ou ses zones d'appui. Le placement est la transformation qui aligne ces informations sur le support sélectionné. Une transformation du support entraîne ses objets enfants en conservant leurs coordonnées relatives.

Conséquences à retenir pour un futur placement contraint :

- Un point d'ancrage se référence par identifiant et par support, pas par une coordonnée mondiale supposée constante.
- La normale pertinente est celle de la surface réellement choisie, y compris sur une face inclinée de volume.
- Un trou de boulon, un ensemble de trous de vis et une zone d'appui n'ont pas le même rôle géométrique.
- Pour un objet à plusieurs points de fixation, l'alignement d'un seul point ne prouve pas que les autres soient utilisables.
- La coïncidence d'une surface d'appui avec le mur ne prouve ni la résistance ni la compatibilité du montage.
- Déplacer librement une pièce pour préparer un bloc doit rester distinguable d'un placement dont les points physiques ont été renseignés et vérifiés.

## Données proposées pour une phase ultérieure

Cette proposition n'est pas un changement du contrat applicatif. Les champs existants sont décrits plus bas ; les éléments suivants restent à spécifier et à valider.

| Donnée | Rôle | Distinction à conserver |
| --- | --- | --- |
| Surfaces du support | Faces et zones d'utilisation possibles | Surface visible, surface d'appui et zone autorisée à recevoir des prises |
| Points filetés | Positions, axes, état et désignation du filetage | Insert existant, trou libre et point inutilisable |
| Fixations de l'objet | Points locaux, axes et rôle de chaque fixation | Boulon principal, vis de fixation et stabilisation complémentaire |
| Interface d'appui | Plan, zones ou repères d'attache propres au modèle | Repère numérique et géométrie physique |
| Construction du volume | Plein, coque ouverte, arrière fermé ou inconnu | Forme extérieure et présence effective de matière |
| Capacités du volume | Possibilité déclarée de recevoir des prises ou volumes | Boulonnage sur inserts, vissage autorisé, capacité absente ou inconnue |
| Provenance | Source, produit, version, date, extrait et auteur de saisie | Notice lue, information client et estimation visuelle |
| État de préparation | Conception libre, points renseignés, incompatibilité repérée ou information manquante | Vérification logicielle et validation du montage physique |

Une compatibilité ne se déduit pas de deux noms identiques : il faut conserver les informations nécessaires et leur périmètre. Les valeurs **M10**, **3/8 pouce** et les espacements **100, 150, 200 ou 250 mm** restent des exemples de sujets à vérifier dans des sources, sans constituer ici des choix par défaut ni des standards attribués à un fabricant. Un filetage impérial et un filetage métrique ne deviennent pas équivalents par simple conversion de diamètre.

### État constaté du contrat logiciel

Au moment de la lecture de `packages/contracts/src/index.ts`, murs et modèles acceptent des métadonnées `fixing` optionnelles : méthode (`unknown`, `bolt`, `screw`, `combined`), diamètre `holeDiameterMm`, désignation et système de filetage, provenance (`status`, `sourceUrl`, `reference`, `checkedAt`). Ils acceptent également une `fixingGrid` optionnelle avec pas et décalages en mètres, rotation en degrés. Ces métadonnées ne décrivent pas encore toutes les interfaces et capacités proposées ci-dessus.

La présence de ces champs ne prouve pas leur affichage complet dans l'interface, ni une contrainte active sur les placements. La provenance `documented` doit correspondre à une documentation réellement identifiée ; aucune donnée fabricant issue de cette recherche bloquée ne reçoit ce statut.

## Proposition de fonctionnement à valider

1. **Conserver la conception libre** pour préparer murs, volumes et blocs. Identifier clairement les modèles d'exemple et les informations physiques non renseignées.
2. **Décrire les supports de la salle réelle** : faces, plans de perçage, inserts, zones autorisées et état des points. Importer ultérieurement un relevé ou saisir les points, sans créer automatiquement de nouveaux perçages.
3. **Décrire les interfaces des références de prises et volumes** à partir des notices : points de fixation, appui et capacités de support. Distinguer modèle virtuel générique et référence physique documentée.
4. **Ajouter ensuite une aide au placement par mode** : choix d'un insert pour une pièce boulonnée ; surface et points de vis pour une pièce prévue pour vissage ; combinaison explicite si plusieurs interfaces sont requises. L'information inconnue reste signalée au lieu d'être inventée.
5. **Présenter une liste de points à contrôler par l'ouvreur**, avec les sources disponibles, sans transformer une vérification géométrique en approbation mécanique.

Le POC implémente désormais le placement contraint décrit ci-dessous. Une bibliothèque de profils fabricant vérifiés reste à réaliser. Le dernier complément ci-dessous décrit les opérations de perçage désormais autorisées par le porteur du projet.

## Recherche effectuée et poursuite documentaire

| URL demandée le 19 octobre 2026 | Objet de la recherche | Résultat effectivement reçu |
| --- | --- | --- |
| <https://www.metoliusclimbing.com/pdf/How-to-Build-a-Home-Bouldering-Wall.pdf> | Guide PDF candidat : construction, panneaux et fixations | Proxy 403 ; document non reçu, existence à ce chemin non vérifiée |
| <https://www.metoliusclimbing.com/> | Retrouver le guide et les notices officielles | Proxy 403 ; page non reçue |
| <https://escapeclimbing.com/> et <https://www.escapeclimbing.com/> | Instructions de montage et matériel | Proxy 403 ; pages non reçues |
| <https://www.atomikclimbingholds.com/> | Fixations boulonnées/vissées, notices de prises et construction | Proxy 403 ; page non reçue |
| <https://www.epclimbing.com/en/> | Murs, supports et documentation technique | Proxy 403 ; page non reçue |
| <https://walltopia.com/climbing-walls/> | Murs, panneaux et plans de fixation | Proxy 403 ; page non reçue |
| <https://www.cheeta-holds.com/> | Produits, volumes et notices de montage | Proxy 403 ; page non reçue |
| <https://flathold.com/> | Produits, macros et fixations | Proxy 403 ; page non reçue |
| <https://www.bluepill-climbing.com/> | Volumes, prises et interfaces de fixation | Proxy 403 ; page non reçue |
| <https://www.mountainproject.com/forum/> | Retours d'expérience et vocabulaire métier | Proxy 403 ; page non reçue |
| <https://www.reddit.com/r/climbing/> | Autre forum de contexte | Proxy 403 ; page non reçue |
| <https://registry.npmjs.org/three/latest> | Témoin d'accès HTTPS sur une destination autorisée | HTTP 200 ; aucune information métier de fixation |

Preuves locales horodatées : `.data/research/fixations-20261019T183240Z/requests.json`, ignoré par Git. Les refus ne sont pas des citations de notices. Il n'existe actuellement aucun extrait de fabricant vérifié à reproduire dans ce document.

Après ouverture effective des domaines dans l'instance : retrouver les documents depuis les sites officiels, vérifier leur version, choisir au moins une référence de prise boulonnée, une prise vissée, un volume fixé en périphérie et un volume proposant des inserts. Pour chaque référence, relever l'extrait exact et sa page, la construction arrière, les points de fixation, les points d'appui, les possibilités d'ajout de prises et les interdictions de modification. Un forum peut éclairer les usages et les difficultés ; il ne remplace pas les instructions de la référence et du système de mur.


## Mise en œuvre du POC après les derniers retours

Les champs facultatifs `mounting` décrivent la méthode et les trous propres de l’objet ; `supportFixings` décrit les inserts récepteurs et l’autorisation de vissage du support. Le générateur enlève réellement la matière des perçages, avec des parois intérieures ; les marqueurs d’inserts sur les pans restent distincts des grandes ouvertures traversantes.

Sans profil explicite, les prises de démonstration reçoivent un trou central de boulonnage ; les volumes reçoivent quatre trous de vissage. La boîte de démonstration fournit un insert récepteur central sur sa face avant. Les autres volumes ne reçoivent pas automatiquement un réseau d’inserts. Ces valeurs et emplacements sont des exemples visuels, jamais des cotes attribuées à un fournisseur. Ils sont calculés sans modifier les JSON de modèles ni leurs empreintes d’inventaire.

Un objet boulonné doit aligner tous ses trous principaux avec des inserts distincts dont la normale et, lorsqu’il est renseigné des deux côtés, le filetage sont compatibles. L’accrochage traduit l’objet en tenant compte de la position réelle de son trou ; il ne déplace pas arbitrairement l’insert. Un objet vissé vérifie chaque point de vis sur une surface autorisée, sans exiger que les vis coïncident avec la trame d’inserts du mur. Les fixations complémentaires sont contrôlées également. La tolérance numérique d’alignement de 0,5 mm n’est pas une tolérance fabricant.

Le survol présente le même candidat que le clic et la validation serveur : vert si accepté, rouge avec les motifs en cas de défaut de fixation, collision ou manque de stock dans l’éditeur. Les anciennes ancres restent consultables et sauvegardables si inchangées ; une ancre nouvelle, déplacée ou réintroduite par restauration respecte ces règles. Aucun perçage nouveau n’est inventé pendant le placement.

Les coques creuses constructeur, les longueurs de vis, la résistance des supports et une certification mécanique ne sont pas modélisées. Le profil synthétique de pyramide conserve la forme paramétrique du POC ; il ne reproduit pas le dos d’un produit commercial.

## Dernier retour : nombre de vis et supports prépercés

Les huit nouvelles tentatives (Metolius, Cheeta, Bluepill, Atomik, Escape, EP, recherche Google et URL candidate Mountain Project) ont toutes échoué au tunnel HTTPS avec `403 Forbidden`. Les réponses techniques sont conservées localement dans `.data/research/fixations-followup/responses.json`. Aucun document ni image de fournisseur n’a été reçu ; l’existence du chemin de forum candidat n’est pas vérifiée. Ce lot ne fournit donc aucune preuve constructeur autorisant deux vis en diagonale ou une vis unique.

Le comportement retenu est conservateur : **toutes les fixations déclarées par le modèle sont obligatoires**. Aucun choix de vis actives ni verdict de stabilité par moteur physique n’est proposé. Calculer une résistance réelle demanderait au minimum le matériau et l’épaisseur du support, l’ancrage, les caractéristiques des vis, les efforts et les consignes du produit ; le seul maillage ne fournit pas ces données.

Le mode prépercé est désormais le défaut des objets vissés. Chaque trou propre doit coïncider avec un **trou pilote** distinct et correctement orienté. Un insert fileté ne compte pas comme trou pilote. Le catalogue permet de créer une variante dont le profil autorise explicitement le vissage direct ; celui-ci contrôle toujours tous les points de vis et l’autorisation du support. Les modèles déjà inventoriés restent immuables.

Les pans acceptent une trame pilote facultative, distincte de leur trame d’inserts. Le panneau des propriétés permet d’en déclarer le pas et le décalage ; les marqueurs pilotes sont orange. Les valeurs proposées lors de l’activation sont des données de démonstration à remplacer par celles du support réel. Le placement ne perce rien automatiquement. Un volume dont les entraxes ne correspondent pas au support est refusé, même si son centre est proche d’un trou.

Deux nouveaux exemples du catalogue ont une identité propre : une pyramide à quatre boulons et quatre inserts sur ses faces inclinées, et un dôme à quatre boulons. Leur géométrie et leurs trous sont explicites et testés. Ils ne reproduisent aucun produit commercial ni aucune image consultée. Ils démarrent sans stock ; l’utilisateur déclare ses exemplaires pour les essayer. Les modèles et exemplaires existants ne sont pas remplacés.

Les placements hérités inchangés restent conservés, avec avertissement dans leurs propriétés s’ils ne respectent pas les règles courantes. Une modification du support peut réparer des défauts hérités sans imposer de déplacer les autres pièces, mais ne peut pas invalider une fixation auparavant valide. Une nouvelle pièce ou une pièce déplacée doit satisfaire toutes ses fixations.

La photo de salle fournie par le porteur du projet montre aussi qualitativement le cas de prises posées sur certains volumes noirs. Elle ne permet pas de relever les filetages, les entraxes ni le nombre de fixations au mur et ne sert donc pas de profil constructeur.


## Complément — modes et préparation autorisée

Le porteur du projet a validé la préparation de trous dans le support **et la modification des trous de la pièce si son produit l’autorise**. L’application distingue désormais :

| Interface | Profil de la pièce | Exigence du support |
| --- | --- | --- |
| Prise ou volume sur pan | Boulonnage | Chaque trou principal aligné avec un insert compatible existant |
| Prise ou volume sur pan | Vissage sur pilotes | Chaque trou de vis aligné avec un pilote existant ou explicitement préparé |
| Prise sur volume | Boulonnage ou vissage | Mêmes règles, dans le repère local du volume ; capacités du volume renseignées séparément |
| Vissage direct | Profil qui déclare ce mode | Tous les points de vis sur une surface autorisant le vissage, sans obligation de trame d’inserts |

**Pièce prépercée et support prépercé sont deux informations différentes.** Un passage de vis dans un volume ne signifie pas que sa vis doit se trouver dans un insert fileté du mur. Le mode choisi détermine s’il faut un insert, un pilote ou une surface autorisée. Les vis à bois décrites dans l’étude provisoire concernent donc potentiellement les deux interfaces volume/panneau mural et prise/panneau mural, ainsi que prise/volume lorsqu’il le permet ; aucune marque précise n’est confirmée par cette généralité.

### Préparer le support

- `allowPilotDrilling` est une permission propre au pan ou à l’exemplaire d’un volume ; un profil `supportFixings.allowDrilling: false` reste prioritaire et interdit la préparation. Le support doit aussi accepter les vis.
- L’action explicite demande un diamètre pilote de 1 à 50 mm. Ces bornes sont des limites de saisie du logiciel, pas une recommandation de foret. Aucun diamètre pilote n’est déduit du trou de passage, du diamètre de vis ou d’un filetage.
- Les trous manquants sont calculés depuis les points de fixation de la pièce, avec sa rotation et le repère du support. Les pilotes déjà présents sont réutilisés. Aucun insert de boulonnage n’est créé par cette action.
- Chaque trou est vérifié sur la surface, y compris son bord ; les recouvrements avec les trous ou inserts existants et les ouvertures sont refusés. Ces contrôles géométriques ne calculent pas de distance structurelle minimale au bord.
- Les `preparedPilotHoles` restent attachés au pan ou à l’exemplaire concerné. Un volume possède réellement ces perçages dans sa géométrie rendue ; son modèle catalogue et ses voisins restent inchangés. Les panoramas de pans montrent les points pilotes orange.
- Le clic de préparation/pose est atomique et annulable. Le panneau des propriétés propose aussi de préparer les pilotes du support d’une pièce sélectionnée. Sauvegarde et restauration conservent les trous, sous les mêmes validations côté serveur. Ces actions de conception ne réalisent ni perçage physique ni réservation de stock.

### Modifier les trous de la pièce

L’éditeur de catalogue exige une `mounting.modificationAuthorization.reference` avant d’activer les commandes d’ajout, déplacement, diamètre, rôle et suppression des trous. La référence peut être une notice ou une instruction identifiée ; elle est déclarée par l’utilisateur et n’est pas automatiquement vérifiée. Le serveur exige aussi une référence déclarée pour changer un schéma de trous existant ; l’autorisation du précédent état permet son retour arrière. Les modèles déjà inventoriés ou placés restent immuables : créer une variante, qui commence sans stock.

L’édition reste limitée au plan de montage des formes paramétriques V1. Elle ne modélise pas encore un perçage oblique quelconque dans un scan ni la structure d’une coque fabricant. Les trous doivent rester dans la matière et ne pas se recouvrir. Tous les trous déclarés restent requis pour la pose ; aucun solveur ne conclut que deux vis en diagonale suffisent.

### Sources de ce complément

Les nouveaux essais vers Metolius (PDF candidat), Atomik, Escape, Cheeta, Bluepill et Entre-Prises ont encore reçu des refus HTTP 403. Le contrôle supplémentaire vers le guide candidat Metolius a également échoué. Aucune notice n’a été reçue ou lue. Les résultats locaux sont conservés dans `.data/research/mounting-modes/responses.json`, ignoré par Git. Le lien Metolius du tableau précédent reste un candidat non vérifié, pas une source technique consultée. Aucune cote ni permission fabricant n’a été ajoutée au catalogue à partir de ces refus.


## Compatibilité déclarée, trames et accès direct à la préparation

Le dernier état documentaire et les règles figurent dans [fabricants-compatibilite.md](fabricants-compatibilite.md). Aucune nouvelle cote fabricant n’est vérifiée. Les pas, décalages et rotation de la trame du pan sont éditables ; une désignation et un système peuvent être saisis pour ses inserts et pour les boulons du modèle. Une exigence explicite n’est plus satisfaite par un insert au filetage inconnu. Le logiciel ne déduit pas le pas d’un diamètre et ne convertit pas implicitement métrique/impérial.

Le choix d’une pièce ouvre le panneau « Réglages de pose », avec le support à préparer, son autorisation et le diamètre pilote. Les règles de fixation restent actives : le parcours corrige l’impasse des quatre vis sans pilotes par une préparation explicite, sans déplacer ni inventer les inserts existants.
