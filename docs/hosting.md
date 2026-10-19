# Hébergement, paiement et changements réversibles

## Direction validée

Le porteur du projet autorise le POC sur une technologie courante et maintenable. La facilité d'hébergement prime sur une technologie particulière. Il ne souhaite pas devoir exploiter une flotte de services. L'architecture doit permettre de changer une page ou un module et de conserver des points de retour.

Le POC n'autorise aucune souscription payante, ouverture de compte fournisseur ou publication en ligne. Les choix de fournisseur, budget, région et nom de domaine restent futurs.

## Chemin d'hébergement proposé

Un **service web Node.js conteneurisé**, servant l'interface construite et l'API sur le même domaine, accompagné d'une **base PostgreSQL gérée** par l'hébergeur. Les modèles 3D externes pourront utiliser un stockage objet privé en V2.

Cette organisation peut être exploitée sur des offres de conteneurs/PaaS d'hébergeurs connus, par exemple Azure ou OVHcloud selon leurs offres disponibles. Il ne s'agit pas d'une intégration déjà testée avec ces fournisseurs, ni d'une comparaison de prix ou d'engagements de disponibilité. Le choix d'un hébergeur demandera un examen de son offre actuelle et de son assistance.

Les sauvegardes, mises à jour PostgreSQL et certificats HTTPS devront autant que possible être gérés par le fournisseur. Le Dockerfile garde une sortie standard indépendante d'une API d'hébergement propriétaire. Aucun Kubernetes, service Redis, file de messages ou moteur de recherche indépendant n'est requis par le POC.

La construction standard est `docker build -t climbed:poc .`. L'image sert l'interface compilée et l'API, utilise un compte système sans privilèges et reçoit `DATABASE_URL` par la configuration de l'hébergeur. Elle respecte `PORT` si l'hébergeur le fournit. Les migrations passent par une étape de déploiement distincte, `npm run db:migrate`, avant le démarrage ; aucune base n'est réinitialisée et aucun compte fictif n'est créé automatiquement.

Dans l'environnement cloud de préparation, BuildKit ne parvenait pas à résoudre le nom du proxy fourni. La construction a utilisé une correspondance temporaire `--add-host` obtenue par la résolution de ce même proxy sur l'hôte. Les arguments proxy standards ont été conservés et le certificat de confiance de la plateforme a été transmis par secret BuildKit `climbed_ca`, sans être copié dans l'image. Cette correction est propre au réseau de préparation : aucune IP de proxy n'est figée dans le dépôt, aucune règle d'accès n'a été contournée et la vérification TLS/SRI est restée active. Un hébergeur sans ce proxy n'a pas besoin de ce certificat.

Pour un vrai pilote externe, il reste à mettre en place et tester : domaine/HTTPS, comptes réels et procédure de récupération, email, révocation des comptes fictifs, sauvegardes/restauration, surveillance et politique d'accès au support. Un conteneur fonctionnel ne vaut pas validation de production.

## Paiement futur

Stripe est un candidat courant, à valider lors de la commercialisation. La première version commerciale pourrait utiliser **Checkout hébergé** et **Customer Portal** pour éviter de développer soi-même la saisie des cartes et la gestion de l'abonnement.

Le domaine conservera des notions indépendantes du fournisseur : client, offre, droits fonctionnels et état d'abonnement. Un adaptateur de facturation traduira les événements Stripe, ou ceux d'un autre prestataire. Le navigateur ne décidera pas seul d'un paiement réussi : les notifications serveur devront être signées, vérifiées et traitées de façon idempotente. Les identifiants du fournisseur resteront des références, pas les identifiants principaux des salles.

Aucune bibliothèque Stripe, clé, page de paiement ou webhook n'est ajouté au POC. Les clients pilotes sont intégrés manuellement ; le fonctionnement de l'éditeur ne dépend pas d'un prestataire de paiement.

## Frontières remplaçables

| Bloc | Frontière et règles |
| --- | --- |
| Une page | Composants et adaptation API séparés du document de scène et de ses commandes. |
| Rendu 3D | Adaptateur Three.js ; identités, paramètres et supports conservés dans les contrats métier. |
| Géométrie | Package indépendant de React, utilisable dans les tests et les validations serveur. |
| Commandes d'édition | Historique local indépendant du stockage et des opérations physiques. |
| API et stockage | Contrat REST et port de repository ; SQL contenu dans l'adaptateur PostgreSQL. |
| Hébergeur | Image de conteneur, variables de configuration, PostgreSQL standard et fichiers externalisables. |
| Paiement futur | Adaptateur fournisseur ; droits et organisations définis dans le domaine. |

Une interface réduit le couplage, mais ne rend pas tout remplacement gratuit. Changer un moteur géométrique demande de revalider les formes ; changer le stockage exige de reprendre les migrations et les garanties transactionnelles ; changer une version de modèle peut nécessiter une migration d'ancrages.

## Points de retour et données

- Les commits cohérents constituent les points de retour du code. Revenir à un ancien code ne rembobine pas le matériel réel.
- Les migrations SQL appliquées sont versionnées et identifiées par empreinte. Une correction utilise une nouvelle migration ; elle ne réécrit pas celle déjà appliquée.
- Pour une évolution déployée, privilégier ajout compatible → migration des données → utilisation du nouveau format → suppression différée des anciens champs. Garder le code précédent compatible pendant la période de retour prévue.
- Une migration destructive nécessite une sauvegarde vérifiée et un plan de restauration. Aucun script de démarrage ne doit supprimer un volume ou réinitialiser silencieusement les salles.
- Restaurer une conception crée une nouvelle révision. Réservations, installations et retours passent par des opérations explicites et auditables.
- Avant publication commerciale, vérifier restauration de la base et des éventuels fichiers dans un environnement distinct, puis définir les objectifs de reprise.
