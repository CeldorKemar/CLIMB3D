# Recherche et vérifications — architecture

## Portée

Relevé effectué pendant la phase d’architecture du 19 octobre 2026. Les lectures du registre npm vérifient les métadonnées des paquets, pas leur installation, leur intégration ni leur comportement. Les versions listées sont des observations, pas un lockfile applicatif.

## Dépendances : métadonnées accessibles

Les endpoints suivants ont été lus en HTTPS avec vérification TLS active.

| Source npm | Version observée | Constat utile |
| --- | --- | --- |
| [React](https://registry.npmjs.org/react/latest) | 19.3.1 | Candidat compatible avec les plages React déclarées par Fiber et Drei observés. |
| [Vite](https://registry.npmjs.org/vite/latest) | 8.3.4 | Node `^20.19.0` ou `>=22.12.0` ; Node 24.19.0 satisfait cette contrainte. |
| [Three.js](https://registry.npmjs.org/three/latest) | 0.186.1 | À geler et tester avec Fiber, Drei et les outils géométriques choisis. |
| [React Three Fiber](https://registry.npmjs.org/@react-three%2ffiber/latest) | 9.8.2 | Déclare React/React DOM `>=19 <19.4`, Three `>=0.156`. |
| [Drei](https://registry.npmjs.org/@react-three%2fdrei/latest) | 10.7.9 | Déclare Fiber `^9`, React 19 et Three `>=0.159`. |
| [NestJS core](https://registry.npmjs.org/@nestjs%2fcore/latest) | 12.2.0 | Node `>=20` ; les paquets Nest associés devront être alignés. |
| [Prisma](https://registry.npmjs.org/prisma) | Stable 7.10.1 ; tag latest 8.0.0-rc.23 | Éviter le tag latest pour l’installation proposée ; il pointe sur une préversion. |
| [Prisma client](https://registry.npmjs.org/@prisma%2fclient) | Stable 7.10.1 | Aligner avec Prisma 7.10.1 ; Node `^20.19`, `^22.12` ou `>=24.0`. |
| [Zustand](https://registry.npmjs.org/zustand/latest) | 5.0.15 | Candidat pour l’état éditeur. |
| [TanStack Query](https://registry.npmjs.org/@tanstack%2freact-query/latest) | 5.104.4 | React 18 ou 19 déclaré. |
| [Manifold](https://registry.npmjs.org/manifold-3d/latest) | 3.5.4 | Candidat éventuel pour un essai CSG futur ; aucun essai de solidité effectué. |

Les métadonnées ne valident pas tous les plugins Vite, adaptateurs Prisma, bibliothèques d’authentification ni outils de tests. Ces dépendances seront choisies, installées et vérifiées après validation de l’architecture. Les versions ne seront pas actualisées automatiquement au gré d’un tag distant.

## Fournisseurs : contenu non accessible

Les tentatives HTTPS vers [Walltopia](https://walltopia.com/climbing-walls/) et [EP Climbing](https://www.epclimbing.com/en/) ont encore échoué au proxy avec `Tunnel connection failed: 403 Forbidden` pendant cette phase. Des tentatives antérieures vers Cheeta, Flathold et Bluepill avaient également échoué. Aucun contenu fabricant, plan technique ou notice n’a donc été vérifié.

Les domaines nécessaires ont été proposés dans un brouillon de configuration réseau. Un brouillon enregistré ne prouve pas une modification du réseau de l’instance actuelle, ni une publication. Aucun blocage n’a été contourné et aucune désactivation de TLS n’a été utilisée.

À documenter avant de proposer des profils fabricant fiables :

- Fixations boulonnées, vissées et points complémentaires par produit.
- Inserts et trames de perçage selon le panneau réellement installé.
- Surfaces autorisées, compatibilités et capacité d’un volume à porter d’autres prises.
- Dimensions de la référence, paramètres de montage et restrictions de la notice.

Aucune valeur de filetage, épaisseur, espacement, résistance ou couple de serrage n’est présentée comme une norme vérifiée. Le logiciel ne délivrera pas de certification mécanique ou réglementaire.

## Photo de référence

La photo fournie montre un ensemble de pans, de nombreux volumes et prises. Elle justifie une scène d’essai dense et la hiérarchie mur → volume → prise. Les couleurs, ombres et perspectives ne permettent pas de déduire des dimensions, inclinaisons ou points de fixation fiables. Aucun comptage exhaustif ni relevé métrique n’a été effectué.

## Vérifications réellement effectuées

- Inspection du dépôt avant rédaction : branche locale `work`, aucun commit ni fichier applicatif, pas de modifications préexistantes.
- Outils observés : Node 24.19.0, npm 11.9.0, Python 3.12.14, Docker CLI 28.4.0 ; daemon et conteneurs non validés.
- Lectures npm décrites ci-dessus.
- Vérifications documentaires et Git consignées dans [l’avancement](progress.md).

Aucun build, test géométrique, test backend, test navigateur ni benchmark applicatif n’a encore été exécuté.

Cette dernière phrase décrit l'état à la fin de la phase documentaire. Le POC a ensuite été implémenté et ses résultats réels sont consignés dans [progress.md](progress.md). Docker, PostgreSQL et Chromium ont été utilisés ; les contrôles ne sont plus limités à la présence des outils.

## Demande 6 — dimensions, perçages, fixations et trames

Vérification réseau effectuée le **19 octobre 2026 à 17:44 UTC**. Les requêtes ont réellement été exécutées avec `urllib.request`, en HTTPS et avec vérification TLS active. Elles n'ont récupéré aucun contenu de fabricant ni de forum. Le message observé est : `Tunnel connection failed: 403 Forbidden`. Ce refus intervient au proxy avant la lecture du site ; il ne permet pas de conclure que la page ou le document existe, manque ou contient une caractéristique particulière.

### Requêtes effectuées

| Cible demandée | Usage recherché | Résultat |
| --- | --- | --- |
| <https://www.epclimbing.com/en/> | Fabricant de murs, informations techniques | Proxy 403 ; contenu non consulté |
| <https://www.cheeta-holds.com/> | Prises, macros et volumes, notices par référence | Proxy 403 ; contenu non consulté |
| <https://flathold.com/> | Prises/macros, géométries et fixations | Proxy 403 ; contenu non consulté |
| <https://settercloset.com/> | Catalogue de prises, dont Kilter | Proxy 403 ; contenu non consulté |
| <https://www.bluepill-climbing.com/> | Volumes et prises, informations de montage | Proxy 403 ; contenu non consulté |
| <https://www.metoliusclimbing.com/> | Documentation de construction et de fixation | Proxy 403 ; contenu non consulté |
| <https://www.atomikclimbingholds.com/> | Fiches de prises et matériel de fixation | Proxy 403 ; contenu non consulté |
| <https://www.walltopia.com/> et <https://walltopia.com/climbing-walls/> | Panneaux, murs, plans techniques et trames | Proxy 403 ; contenu non consulté |
| <https://www.mountainproject.com/forum/> | Contexte et retours de pratiquants, sans valeur de notice fabricant | Proxy 403 ; contenu non consulté |
| <https://www.metoliusclimbing.com/pdf/How-to-Build-a-Home-Bouldering-Wall.pdf> | Chemin candidat d'un guide PDF de construction | Proxy 403 ; existence du PDF et contenu non vérifiés |
| <https://www.ep-holds.com/> et <https://www.entre-prises.com/> | Domaines alternatifs candidats pour documentation fabricant | Proxy 403 ; pertinence actuelle et contenu non vérifiés |
| <https://www.escapeclimbing.com/> | Autre fabricant candidat pour documentation technique | Proxy 403 ; contenu non consulté |
| <https://www.reddit.com/r/climbing/> | Autre forum de contexte | Proxy 403 ; contenu non consulté |
| <https://www.climbingbusinessjournal.com/> | Presse professionnelle, recherche de références | Proxy 403 ; contenu non consulté |
| <https://www.google.com/search?q=climbing+wall+tnut+hole+diameter+Metolius> | Recherche de documents techniques officiels | Proxy 403 ; aucun résultat reçu |

Une requête témoin vers <https://registry.npmjs.org/three/latest> a reçu **HTTP 200** pendant la même vérification. L'accès HTTPS est donc possible pour cette destination autorisée ; cela n'établit pas l'ouverture des domaines de recherche. Le détail horodaté des dernières requêtes est conservé localement dans `.data/research/demande6-network-checks.json` (fichier ignoré par Git). Aucun relais de contournement, certificat désactivé ni nouvel extrait prétendument lu n'a été utilisé.

### Ce que les preuves ne permettent pas d'affirmer

Aucune fiche fournisseur n'a été lue : il n'existe donc pas encore de dimensions réelles, plan de perçage, entraxe ou système de fixation vérifié par référence dans ce relevé. Les mentions **M10**, **3/8 pouce** et **100/150/200/250 mm** sont des sujets à vérifier, pas des caractéristiques attestées ou des normes universelles. Une source future devra préciser la référence, la version et les unités ; un forum ne remplacera pas la notice du produit.

### Conséquences pour le modèle paramétrique

Ces points constituent une proposition de modélisation, et non des faits fabricant vérifiés :

- Séparer le **diamètre du perçage du panneau**, le **filetage de l'insert**, le **passage du boulon dans la prise** et les **trous pour vis**. Une désignation de filetage ne renseigne pas à elle seule le diamètre de perçage du bois. Conserver une désignation métrique ou impériale explicite et, lorsqu'il est connu, le pas de filetage ; une conversion de longueur ne démontre pas la compatibilité mécanique.
- Décrire une trame par son origine locale, ses deux espacements, son orientation, un éventuel décalage de rangée et ses points supprimés ou ajoutés. Autoriser une liste de points libre. Toute valeur initiale utilisée pour la démonstration doit rester modifiable et être présentée comme un réglage d'exemple, sans association implicite à une marque.
- Distinguer la **fixation de l'objet sur son support** et les **points qu'il offre pour recevoir d'autres objets**. Prévoir les états boulonné, vissé, combinaison et inconnu, sans attribuer automatiquement un mode de fixation à toutes les prises ou à tous les volumes.
- La catégorie visuelle « volume » ou « macro » ne prouve ni la présence d'inserts ni la possibilité de recevoir d'autres prises. Décrire cette capacité, les surfaces admises et les points disponibles séparément, avec un état « non renseigné ». Distinguer également l'absence d'inserts d'une information manquante.
- Conserver modèle, exemplaire physique et placement séparés. Un placement peut avoir pour support un pan ou une surface d'un autre objet ; cette hiérarchie doit empêcher les cycles et préserver la position relative lors du déplacement du support.
- Associer aux caractéristiques documentées une provenance : fabricant, référence, URL, date de lecture, identifiant/version du document, extrait et statut de vérification. Les paramètres saisis par le client et les dimensions estimées visuellement ne doivent pas être étiquetés « fabricant vérifié ».

Le modèle V1 reste constitué de formes paramétriques : murs, volumes, prises pleines ou à cavité. Les scans sont reportés. La visualisation et la détection d'intersections ne délivrent aucune validation de montage ou de résistance.

Coordination avec le contrat du POC : `fixing` est optionnel sur les murs et modèles ; il sépare `method`, `holeDiameterMm`, `threadDesignation`, `threadSystem` et une provenance (`status`, `sourceUrl`, `reference`, `checkedAt`). `fixingGrid`, optionnel sur les murs et modèles, décrit `pitchX`, `pitchY`, `offsetX`, `offsetY` en **mètres**, et `rotationDegrees` en degrés ; le diamètre reste explicitement en **millimètres**. Ces champs n'attestent aucune marque et ne constituent pas un profil constructeur. Les points libres, décalages de rangées, surfaces autorisées, pas de filetage et capacités détaillées de support ci-dessus restent des besoins à spécifier : leur présence dans cette proposition ne signifie pas qu'ils sont implémentés. Le diamètre doit toujours être interprété avec son contexte d'objet et de trou, sans le confondre avec la désignation du filetage.

### Travail restant après ouverture du réseau

Lire les notices et fiches effectivement accessibles, relever des références précises avec leur document et leur extrait, puis confirmer séparément dimensions, perçages, trames, boulons/vis et inserts optionnels. Les catalogues de murs, de volumes et de prises doivent rester distincts. Pour toute information issue d'un forum, préciser son rôle de retour d'expérience et rechercher une confirmation fabricant avant d'en tirer un profil de produit.

## Reprise — montage physique des prises et volumes

Le relevé métier détaillé est disponible dans [fixations.md](fixations.md). Il distingue boulonnage sur insert existant, vissage prévu dans le support, fixation complémentaire contre la rotation, et modification physique d'une pièce. Il explique également comment une coque pyramidale à arrière ouvert peut avoir des zones d'appui planes et des fixations périphériques, sans imposer cette construction à tous les produits. Ces explications restent des connaissances générales provisoires, faute de notice reçue.

Nouvel essai réseau le **19 octobre 2026 à 20:28:58 UTC** : les neuf requêtes fabricant/PDF/forum listées dans le relevé sont refusées avec `Tunnel connection failed: 403 Forbidden` ; le témoin npm reçoit HTTP 200. Fichier de preuve ignoré par Git : `.data/research/fixations-20261019T202858Z/requests.json`. Aucune notice ni discussion de forum n'a été lue lors de cet essai. Les domaines supplémentaires ont été proposés dans un brouillon de configuration, ce qui ne démontre ni leur publication ni une ouverture de cette instance.

La solution proposée sépare les **fixations de l'objet sur son support** et les **points ou surfaces qu'un support offre aux autres objets**. Elle prévoit ultérieurement un placement sur insert avec rotation autour de l'axe pour une référence boulonnée, un placement sur zones autorisées avec points de vis pour une référence vissée et un état explicite lorsque l'information manque. Cette proposition attend la décision de l'utilisateur ; aucun moteur de montage contraint n'est ajouté par cette recherche.
