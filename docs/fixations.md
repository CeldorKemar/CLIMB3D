# Prises, volumes et supports : fixation et conséquences pour Climbed

## Statut de cette étude

Ce document répond à la demande d'explication sur les pratiques de fixation et propose un modèle fonctionnel **à valider**. Il ne change ni les placements ni les règles de montage du logiciel.

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

Les placements contraints, le perçage de nouvelles pièces et une bibliothèque de profils fabricant ne sont pas implémentés par cette étude. La décision à obtenir porte sur ce fonctionnement et son niveau de détail avant d'en changer le comportement.

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
