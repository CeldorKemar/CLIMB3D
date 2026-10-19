# Spécifications — cadrage validé

## Statut et priorité

Le porteur du projet a validé la phase 0, puis autorisé le POC après présentation de l'architecture. Le développement s'effectue par petits lots démontrables avec des points de retour Git. Les phases importantes suivantes restent soumises à validation.

La valeur centrale est un **éditeur 3D solide et simple sur laptop**, destiné en premier lieu à l’escalade de bloc. Les écrans d’administration accompagnent ce parcours. Le développement initial ne doit pas se transformer en portail de gestion déconnecté de la conception 3D.

## Organisation et droits métier

Hiérarchie retenue : plateforme → client/organisation → salles → zones → pans de mur.

Un client peut être une chaîne possédant plusieurs salles. Cette organisation ne tranche pas le statut juridique des franchisés : toute structure intégrée à un même client partagera les ressources explicitement prévues pour ce client.

| Profil | Périmètre métier validé |
| --- | --- |
| Superadmin | Le fondateur administre la plateforme et ses clients. |
| Admin client | Administre toutes les salles de son client. |
| Responsable de salle | Administre uniquement sa salle. |
| Ouvreur | Conçoit les murs et parcours, crée et suit les blocs dans les salles autorisées. |

Les bibliothèques de modèles de prises, volumes et murs sont partagées entre les salles d’un client. Les stocks physiques appartiennent à une salle. Le partage entre clients et les transferts physiques entre salles ne font pas partie du POC.

## Vocabulaire

- **Pan** : surface structurelle plane d’un mur ; plusieurs pans peuvent former un assemblage.
- **Prise** : élément de main ou de pied, indépendant de sa taille.
- **Volume** : relief ajouté sur un mur, éventuellement utilisable directement par le grimpeur et capable de recevoir des prises lorsque sa conception le permet.
- **Bloc** : parcours associé à des prises installées, avec départs, arrivée, cotation et état métier.
- **Modèle** : définition réutilisable d’une forme et de ses caractéristiques.
- **Exemplaire** : pièce physique possédée par une salle.
- **Placement** : occurrence d’un modèle dans un projet ; son affectation à un exemplaire intervient au moment de la réservation.
- **Fixation** : point ou système d’attache ; distinct d’une grande ouverture traversant un mur.

## Parcours central du POC

1. Un ouvreur choisit sa salle et sa zone de travail.
2. Il assemble des pans simples : vertical, dévers ou toit. Il règle dimensions, angles et sommets.
3. Il ajoute des volumes de bibliothèque paramétrique : prismes, pyramides, boîtes, dômes et formes creuses.
4. Il choisit une prise et clique sur le support pour la poser plusieurs fois ; il peut régler position et rotation.
5. Il compose un bloc, marque départs et arrivée et sauvegarde.
6. Il rouvre le projet et retrouve la géométrie et ses placements.
7. Il effectue un check-in : les pièces nécessaires sont réservées avant son déplacement en réserve.
8. Il retire son matériel, l’installe, puis confirme l’installation.
9. Pour une modification, il réserve seulement les ajouts. Les pièces retirées ne redeviennent disponibles qu’après démontage et retour confirmés.

Le POC inclut les bases d’annulation/rétablissement, les sauvegardes et le rechargement. Une ouverture géométrique traversante doit aussi servir de preuve technique avant extension aux découpes avancées. L’édition de toutes les formes polygonales complexes reste un lot ultérieur de la V1, à valider séparément.

## Conception et matériel physique

La conception ne réserve aucun matériel tant qu’aucun check-in n’est demandé. **La recette du POC a changé la règle d’ajout :** la bibliothèque affiche le stock disponible et bloque l’ajout d’une pièce indisponible, en tenant compte des besoins déjà dessinés et des pièces affectées réutilisables. Plusieurs sauvegardes alternatives ne constituent toujours pas des réservations physiques. L’API de réservation reste l’autorité face aux opérations concurrentes.

Le check-in réserve les pièces disponibles pour un projet et un ouvreur. La confirmation d’installation constitue une action distincte. Plusieurs ouvreurs doivent pouvoir travailler sans se réserver la même pièce.

Exemple : une salle possède un seul volume V. Deux projets peuvent l’utiliser en conception. Dès qu’un ouvreur réserve V pour le premier projet, une seconde réservation incompatible est refusée. V devient disponible après annulation avec retour si nécessaire, ou après démontage et retour lorsqu’il était installé.

Le stock distingue le total possédé, les pièces disponibles, réservées et installées. Une attente de retour maintient la pièce indisponible. Une pièce physique utilisée dans plusieurs blocs au même emplacement est comptée une fois.

Une version projetée et une version installée peuvent coexister. Modifier le projet ne modifie ni l’état du matériel réel, ni la scène installée, sans opération explicite.

## Portée géométrique

- Construction par assemblage de pans et réglage de leurs dimensions et orientations.
- Prises posées sur un mur ou sur les surfaces autorisées d’un volume.
- Un volume est fixé sur un mur ; volume sur volume exclu du POC, mais évolution à préserver.
- La photo fournie sert de référence visuelle de complexité, pas de relevé métrique ou de reconstruction automatique.
- Les dimensions, dispositions de trous et compatibilités propres aux fabricants restent à documenter. Aucune valeur présentée comme norme n’est validée à ce stade.

## Corrections demandées après la recette du premier POC

- Refuser les contacts et intersections entre pièces distinctes, y compris après déplacement ou rotation. Le contact d’une prise avec son propre support demeure nécessaire et autorisé. La géométrie des pièces, y compris les cavités, fait foi ; une boîte englobante sert seulement à accélérer les contrôles.
- Afficher la longueur du pan et ses projections verticale et horizontale : sur un toit horizontal, la longueur correspond à sa profondeur. Un assistant doit raccorder les segments d’un même mur, par exemple trois segments de 1 m à 0°, 30° puis 0° d’inclinaison absolue.
- Garder la construction des pans dans la salle. Créer et renseigner les modèles achetés dans un éditeur de catalogue séparé, avec une première modélisation paramétrique sommaire. Les dimensions d’une pièce ne se personnalisent plus sur une occurrence de la salle. Les modèles déjà utilisés ne doivent pas être transformés rétroactivement.
- Conserver le brouillon de salle lors du passage vers le catalogue et du retour à la salle. Le changement de vue ne vaut ni sauvegarde ni abandon.
- Créer des voies, associer prises **et volumes** à plusieurs voies, et filtrer réellement leur visibilité par cases à cocher. Les supports nécessaires aux objets visibles restent affichés.
- Afficher les quantités dans la bibliothèque, griser les modèles sans disponibilité et regrouper la navigation du stock sur le bouton latéral. La déclaration d’un inventaire physique est explicite et réservée aux responsables autorisés.
- Sauvegarder des états nommés d’une salle entière ou d’une voie. Restaurer une voie doit conserver les autres voies et leurs pièces partagées ; une incompatibilité d’une ressource partagée, une collision, une révision obsolète ou un manque de stock entraîne un refus sans effet partiel. Une restauration crée une nouvelle révision de conception et ne réécrit pas les occupations physiques.
- Conserver les scènes anciennes à l’ouverture : signaler leurs éventuels contacts existants et permettre leur correction, sans modifier les données silencieusement. Les nouveaux contacts restent interdits et une restauration exige une géométrie entièrement valide.

La recherche de fiches fabricant et de forums a été renouvelée. Les refus réseau et les informations encore inconnues sont consignés dans [research.md](research.md). Les valeurs saisies ou génériques ne deviennent pas des spécifications fournisseur par défaut.

## Corrections complémentaires après la seconde recette

- Le catalogue de projet filtre les prises et volumes avec deux onglets et une recherche libre extensible. Le détail des futurs filtres structurés reste à définir.
- L’éditeur de modèles s’ouvre uniquement depuis son icône dans le menu latéral principal ; la palette de placement ne contient plus de bouton de création/édition.
- Une sélection de pan ou d’élément accepte suppression, copie/collage et duplication au clavier. Le pan est copié avec ses enfants, sous de nouveaux identifiants, en préservant les associations avec les voies existantes. Le stock et les collisions sont contrôlés atomiquement avant ajout ; la suppression reste locale à la conception et réversible. Les champs de texte, le catalogue et les fenêtres modales ne doivent pas déclencher ces actions de salle.
- L’assistant multi-inclinaisons affiche chaque cause de refus dans sa fenêtre, avec des noms lisibles ; aucun ajout partiel et aucune fermeture après refus.
- Étudier la distinction entre fixation de l’objet sur son support et capacités du support à recevoir des objets, avant de modifier les règles de placement. La proposition boulonnage sur inserts / vissage sur zones autorisées et ses limites documentaires figurent dans [fixations.md](fixations.md). La demande suivante autorise ce placement contraint dans le POC avec profils synthétiques explicitement distingués des références fabricant.

## V2 et exclusions

La V2 doit pouvoir accueillir des modèles **scannés ou modélisés dans un logiciel 3D**. Le POC prépare un contrat de modèle compatible ; il n’implémente ni capture, ni import, ni photogrammétrie, ni reconstruction depuis une photo. La numérisation seule ne fournira pas automatiquement les informations de fixation.

Sont aussi reportés : interface publique/grimpeur, historique personnel de pratique, défis et fonctions ludiques, abonnement autonome en ligne, application mobile native, réseaux sociaux avancés, compétitions complexes et génération de blocs par IA.

L’historique métier des projets, installations et stocks demeure dans le périmètre. Les premiers clients seront intégrés manuellement par le fondateur, avec possibilité de pilotes gratuits ; aucune intégration de paiement n’est requise pour le POC.

## Démonstration attendue

Créer une salle, assembler un mur, ajouter volumes et prises, composer un bloc, sauvegarder/recharger et effectuer une réservation. Une tentative concurrente sur la dernière pièce doit être refusée sans effet partiel. Un utilisateur d’un autre client ne doit pas accéder à la scène ou au stock.

Les objectifs chiffrés de performance, détails des permissions sensibles et choix d’exploitation sont des propositions d’architecture, pas des décisions métier déjà validées.


## Derniers retours : sélection, plan et niveaux

- Ctrl + clic gauche ajoute ou retire des prises et volumes de la sélection ; seule la suppression groupée est proposée pour plusieurs pièces. L’opération est atomique, annulable et nettoie les associations de voies.
- Supprimer une voie avec ses pièces conserve les placements partagés avec une autre voie et les supports nécessaires à des enfants conservés. Aucune réservation ni installation physique n’est annulée par cette opération de conception.
- Une minimap projette les pans réels sur XZ, avec inclinaison, orientation et épaisseur, sans les réarranger. Elle se masque, s’agrandit, filtre les niveaux et cadre le pan cliqué dans l’éditeur.
- La salle possède des sols finis associés à des niveaux nommés et une altitude en mètres. Changer l’altitude transporte les pans associés et leurs enfants. Des escaliers droits relient deux niveaux ; sauvegarde, rechargement et historique conservent ces données.
- Les trous de fixation propres aux prises et volumes sont réellement traversants. Boulonnage sur inserts compatibles, vissage sur surfaces autorisées et aperçu vert/rouge sont contrôlés par des règles partagées avec l’API. Les données fabricant restent à documenter ; les exemples du POC ne les remplacent pas.
