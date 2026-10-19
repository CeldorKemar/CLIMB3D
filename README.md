# Climbed — gestion et conception 3D de salles d’escalade

Climbed est un projet SaaS destiné aux exploitants de salles d’escalade. Son premier objectif est de permettre à un ouvreur de concevoir facilement des murs de bloc, d’y placer volumes et prises, puis de réserver le matériel nécessaire à leur installation.

Le dépôt technique conserve le nom `CLIMB3D`. Le nom produit retenu dans les échanges est **Climbed**.

## État du projet

- **Phase 0 : cadrage validé par le porteur du projet.**
- **Phase 1 : proposition d’architecture documentée, en attente de validation.**
- Aucun frontend, backend, schéma exécutable, migration ou service applicatif n’est encore implémenté.
- Les contrôles d’environnement et documentaires ne constituent pas des tests de l’application.

## Documents

| Document | Objet |
| --- | --- |
| [Spécifications](docs/specifications.md) | Besoins validés, périmètre du POC et parcours métier. |
| [Architecture](docs/architecture.md) | Organisation du logiciel, accès, persistance et exploitation proposés. |
| [Éditeur 3D](docs/editor-3d.md) | Géométrie, interactions, performances et modèles 3D futurs. |
| [Données](docs/database.md) | Entités, réservations, concurrence et invariants. |
| [Décisions](docs/decisions.md) | Distinction entre décisions métier validées et propositions techniques. |
| [Tests](docs/testing.md) | Scénarios et critères de validation à implémenter. |
| [Recherche](docs/research.md) | Sources consultées, versions observées et limites documentaires. |
| [Avancement](docs/progress.md) | Travail réalisé et validations attendues. |

## Développement

L’installation de l’application et ses commandes seront ajoutées après validation de l’architecture. Ne pas exécuter une installation `latest` en supposant que les dépendances ont déjà été sélectionnées et testées ensemble.

La préparation a constaté Git, Node.js 24.19.0, npm 11.9.0, Python 3.12.14 et Docker CLI 28.4.0. La présence de Docker CLI ne prouve pas que son daemon est utilisable. Le fonctionnement applicatif et l’installation locale Windows 11 ne sont pas encore validés.
