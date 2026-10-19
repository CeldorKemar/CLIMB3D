# Spécifications — cadrage validé

## Statut et priorité

Le porteur du projet a validé la phase 0 et autorisé la phase d’architecture. Toute implémentation attend la validation de cette architecture.

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

La conception est entièrement théorique tant qu’aucune réservation n’est demandée. Un modèle absent du stock peut être utilisé. Dix variantes de murs peuvent réutiliser le même modèle sans consommer dix exemplaires physiques.

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

## V2 et exclusions

La V2 doit pouvoir accueillir des modèles **scannés ou modélisés dans un logiciel 3D**. Le POC prépare un contrat de modèle compatible ; il n’implémente ni capture, ni import, ni photogrammétrie, ni reconstruction depuis une photo. La numérisation seule ne fournira pas automatiquement les informations de fixation.

Sont aussi reportés : interface publique/grimpeur, historique personnel de pratique, défis et fonctions ludiques, abonnement autonome en ligne, application mobile native, réseaux sociaux avancés, compétitions complexes et génération de blocs par IA.

L’historique métier des projets, installations et stocks demeure dans le périmètre. Les premiers clients seront intégrés manuellement par le fondateur, avec possibilité de pilotes gratuits ; aucune intégration de paiement n’est requise pour le POC.

## Démonstration attendue

Créer une salle, assembler un mur, ajouter volumes et prises, composer un bloc, sauvegarder/recharger et effectuer une réservation. Une tentative concurrente sur la dernière pièce doit être refusée sans effet partiel. Un utilisateur d’un autre client ne doit pas accéder à la scène ou au stock.

Les objectifs chiffrés de performance, détails des permissions sensibles et choix d’exploitation sont des propositions d’architecture, pas des décisions métier déjà validées.
