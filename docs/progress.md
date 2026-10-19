# Avancement

## Phase 0 — cadrage

**État : validé par le porteur du projet.**

Le périmètre a été recentré sur la conception 3D de blocs, les organisations multisalles et un stock lié à la réalité terrain. Le check-in réserve avant retrait physique ; l’installation et les retours sont confirmés distinctement. Le POC utilise des modèles paramétriques ; V2 doit pouvoir ajouter des modèles scannés ou modélisés.

## Phase 1 — architecture

**État : documentée, validation utilisateur attendue avant implémentation.**

Travail réalisé :

- Cadrage validé consigné dans specifications.md.
- Architecture web/API/base modulaire et règles d’accès proposées.
- Contrat de géométrie versionnée pour paramétrique V1 et assets 3D V2.
- Modèle de données, réservations concurrentes et état installé séparé des projets.
- Stratégie de tests et critères de démonstration.
- Sources techniques et limites de la recherche fabricant consignées.

Contributions indépendantes : un agent architecture/données, un agent éditeur 3D et un agent QA ont produit leurs documents respectifs. L’agent principal a intégré et relu la proposition. Aucune de ces contributions ne constitue une implémentation ou une validation applicative.

## Vérifications

Les contrôles ci-dessous portent sur la documentation et les métadonnées techniques. Aucun test applicatif n’existe encore.

- Neuf documents Markdown contrôlés : douze liens locaux valides, blocs de code fermés et fins de fichiers correctes.
- `git diff --cached --check` exécuté sans erreur avant le commit documentaire.
- Métadonnées npm consultées : versions candidates et contraintes de runtime ; sélection proposée de Prisma/client 7.10.1 stables plutôt que du tag Prisma `latest` pointant vers une RC.
- Relecture indépendante QA : pas de blocage majeur constaté sur les invariants documentés ; une divergence de définition du delta a été corrigée pour utiliser l'état réservé/installé réel, y compris les interventions partielles.
- Relecture d'intégration : précisions sur les permissions client déjà validées, les assets futurs, les variantes physiques et l'ordre de traitement des retries idempotents.
- Les documents seuls seront conservés dans le premier commit local. Aucun push distant ni publication de l'environnement n'est effectué par cette phase.

## Limites et risques ouverts

- Accès aux documents fabricants toujours bloqué au proxy ; aucune cote ou compatibilité certifiée.
- Compatibilité de la pile fondée sur métadonnées npm, sans installation ni build intégré.
- Aucun modèle paramétrique ni import GLB implémenté ; aucune performance mesurée.
- Aucun service, PostgreSQL, migration, sauvegarde ou restauration applicative démarré.
- Windows 11 et laptop de référence non testés.
- Hébergeur, email et exigences opérationnelles à préciser avant un pilote externe.

## Suite

Après validation de l’architecture : créer le socle exécutable et un premier parcours 3D sauvegardé, puis l’élargir par petits lots validés. Les bibliothèques, accès et stocks doivent être testés avec plusieurs clients et salles avant un usage partagé. Les fonctions reportées ne sont pas autorisées par la seule présence de contrats d’extension dans cette architecture.
