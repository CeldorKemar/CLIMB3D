# Compatibilité des fixations : état des sources et règles du POC

## Résultat du contrôle documentaire

**La recherche fabricant reste bloquée.** Les demandes ci-dessous ont toutes reçu `Tunnel connection failed: 403 Forbidden` du proxy, avant réception des pages. Aucune notice, cote, prescription de vis ou clause de norme n’a été lue. Le témoin npm reçoit HTTP 200. Les réponses horodatées sont conservées localement dans `.data/research/standards-review/responses.json`, ignoré par Git.

| Destination demandée | Objet | Résultat |
| --- | --- | --- |
| [Metolius, chemin PDF candidat](https://www.metoliusclimbing.com/pdf/How-to-Build-a-Home-Bouldering-Wall.pdf) | Construction du support et fixations | Proxy 403 ; existence du document à ce chemin non vérifiée |
| [Atomik](https://www.atomikclimbingholds.com/) | Prises, vis et boulons | Proxy 403 |
| [Escape](https://escapeclimbing.com/) | Prises, volumes, matériel de fixation | Proxy 403 |
| [Cheeta](https://www.cheeta-holds.com/) | Prises, macros et volumes | Proxy 403 |
| [Bluepill](https://www.bluepill-climbing.com/) | Volumes et prises | Proxy 403 |
| [Flathold](https://www.flathold.com/) | Produits et interfaces | Proxy 403 |
| [EP Climbing](https://www.epclimbing.com/en/) | Murs et panneaux | Proxy 403 |
| [Walltopia](https://walltopia.com/climbing-walls/) | Structures et panneaux | Proxy 403 |
| [Boutique AFNOR](https://www.boutique.afnor.org/) | Normes et périmètres applicables | Proxy 403 |
| Recherche Google sur EN 12572-3 et les fixations | Retrouver les références officielles | Proxy 403 |

Les liens sont des **destinations recherchées, pas des citations techniques consultées**. La série EN 12572 est une piste de recherche ; son édition applicable, ses clauses et leurs conséquences pour les fixations ne sont pas établies dans cette session. L’hypothèse d’une trame unique permettant à tous les volumes et toutes les prises de se monter sur tous les murs reste non démontrée.

Le brouillon de configuration contient déjà les destinations fabricant précédentes. Des destinations AFNOR, CEN/CENELEC, DIN Media, BSI, 360, Kitka et Expression ont été ajoutées pour poursuivre l’étude. Le résultat de sauvegarde exige une publication : enregistrer le brouillon ne change pas l’accès du processus courant. Aucune nouvelle dimension constructeur ne doit être ajoutée tant que les documents ne sont pas reçus.

## Ce que contrôle le logiciel

La compatibilité est décrite par les interfaces déclarées, sans déduction depuis le nom de la marque :

| Donnée | Règle implémentée | Limite documentaire ou physique |
| --- | --- | --- |
| Dimensions de la pièce | Géométrie et collisions selon le modèle | Dimensions de démonstration inchangées ; aucune nouvelle cote fabricant |
| Trame des inserts du pan | Pas X/Y, décalages et rotation propres au pan | Le pas historique de 0,25 m est un exemple ; aucune trame universelle revendiquée |
| Passage de fixation de la pièce | Chaque trou déclaré doit être utilisable | Son diamètre ne détermine ni un filetage ni un diamètre pilote |
| Filetage du boulon | Désignation et système déclarés doivent correspondre à ceux de l’insert | Un insert inconnu ne satisfait plus une exigence explicite ; aucune conversion ou déduction de pas |
| Vis sur trous pilotes | Tous les points de vis doivent coïncider avec des pilotes distincts et orientés correctement | Un insert fileté n’est pas un pilote |
| Préparation de pilotes | Permission du support et diamètre explicites ; vérification de surface, bord et recouvrement | Pas de prescription de foret, profondeur, longueur de vis ou résistance |
| Vissage direct | Profil de pièce déclarant ce mode et support autorisant les vis | Ne signifie pas que tous les matériaux ou produits le permettent |
| Prise sur volume | Interface réceptrice du volume, indépendante de son attache au mur | La forme extérieure seule ne donne aucune autorisation de fixation |

Les champs `threadSystem` sont facultatifs sur le montage et les points récepteurs. La trame générée d’un pan reprend sa désignation et son système déclarés. Si la pièce exige une désignation ou un système précis, l’insert doit les renseigner et correspondre. Les espaces, la casse et les caractères `x`/`×` sont normalisés ; aucune équivalence entre désignations incomplètes, séries, pas ou unités n’est supposée. Les modèles génériques sans spécification restent des exemples géométriques non certifiés.

Le catalogue permet de renseigner le filetage d’une pièce boulonnée ; les propriétés du pan permettent de saisir sa trame et les informations de ses inserts. Les points explicites d’un relevé restent prioritaires sur une trame générée. Les changements saisis sont marqués comme données utilisateur, sans devenir une provenance « fabricant vérifié ».

## Pourquoi les volumes étaient impossibles à poser

Les volumes génériques ont quatre trous de vis, le mode par défaut exige des pilotes et les pans de démonstration n’en possèdent pas. Déplacer la pièce ne peut donc pas trouver un alignement. La condition était explicitée uniquement par les erreurs de survol et une option de préparation peu visible.

Le panneau **Réglages de pose** s’ouvre maintenant dès le choix d’une pièce. Il affiche le nombre de fixations, le support, ses pilotes, l’option de préparation, son autorisation et le diamètre à renseigner. Le support survolé devient le support à préparer ; il peut aussi être choisi dans la liste. La préparation reste explicite et ne transforme pas les inserts en pilotes. Les cinq formes de volumes génériques sont vérifiées dans un parcours navigateur utilisant les mêmes profils sans montage explicite que les anciens documents.

## Relevé à compléter lorsque l’accès sera ouvert

Pour chaque référence réellement consultée, conserver : fabricant, référence commerciale, version/date de notice, URL, page et extrait exact ; dimensions et construction de la pièce ; positions/axes des fixations ; boulons et filetages complets ; vis, quantités obligatoires et conditions de préperçage ; supports admis et capacité à recevoir des prises. Une matrice entre marques doit comparer ces données pour des références identifiées, sans promettre une compatibilité générale à partir d’un seul diamètre.

Avant tout profil dit documenté, vérifier séparément les normes applicables et les instructions produit. Une exigence d’essai ou de sécurité n’établit pas, à elle seule, une trame d’inserts commune. Les résultats de forums doivent rester des retours d’expérience jusqu’à confirmation par la notice concernée.

Un contrôle final ciblé de Metolius, Atomik et AFNOR a encore reçu le même refus du proxy. Réponses conservées dans `.data/research/standards-review/recheck.json`.
