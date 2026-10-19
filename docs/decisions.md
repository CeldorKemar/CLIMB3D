# Registre des décisions

## Lecture

**Validé** signifie décidé par le porteur du projet dans le cadrage. **Proposé** signifie à soumettre pendant la phase d’architecture. **Reporté** indique une fonction explicitement absente du POC. La présence d’un document ou d’une bibliothèque candidate ne vaut pas validation d’implémentation.

| Référence | Statut | Décision et conséquence |
| --- | --- | --- |
| F01 | Validé | Priorité à l’éditeur 3D pour le bloc, sur laptop. Les tableaux de bord ne remplacent pas cette démonstration. |
| F02 | Validé | Un client peut gérer plusieurs salles ; catalogue de modèles partagé au sein du client. |
| F03 | Validé | Superadmin plateforme, admin client, responsable de salle et ouvreur avec périmètres distincts. |
| F04 | Remplacé lors de la recette | La conception ne réserve aucun stock, mais la bibliothèque bloque désormais l’ajout d’un modèle indisponible. |
| F05 | Validé | Check-in = réservation avant déplacement en réserve ; installation confirmée séparément. |
| F06 | Validé | Modification par différence : réserver les ajouts, libérer les retraits après démontage/retour. |
| F07 | Validé | V1 : mur → volume → prises. Volume sur volume absent du POC, possibilité à préserver. |
| F08 | Validé | Bibliothèque paramétrique de formes simples suffisante pour le POC. |
| F09 | Validé | Première intégration commerciale par le fondateur, pilotes possibles gratuits. |
| F10 | Validé | Phase 0 acceptée et phase 1 architecture autorisée ; aucune implémentation avant validation suivante. |
| F11 | Exigence d’évolution | Préparer des modèles scannés et modélisés en 3D pour V2, sans les implémenter maintenant. |
| A01 | Proposé | Monolithe modulaire TypeScript, web React/Vite et API NestJS : transactions simples, déploiement raisonnable. |
| A02 | Proposé | PostgreSQL partagé avec cloisonnement client/salle, contraintes composées et autorisations serveur ; base dédiée alternative contractuelle future. |
| A03 | Proposé | Géométrie paramétrique versionnée comme source V1 ; maillage de rendu dérivé. |
| A04 | Proposé | Modèle géométrique extensible avec provenance paramétrique ou asset GLB ; origine/échelle/fixations explicites, versions immuables. |
| A05 | Proposé | Calculs géométriques indépendants de Three.js ; Web Worker pour les calculs lourds. |
| A06 | Proposé | Contours 2D avec trous extrudés pour les découpes de pans plans ; pas de CSG général par défaut. |
| A07 | Proposé | Sessions serveur révocables, cookie protégé, protection CSRF, invitations manuelles initiales. |
| A08 | Proposé | Prisma et client stables de même version, avec SQL contrôlé pour contraintes et verrous ; ne pas suivre aveuglément `latest`. |
| A09 | Proposé | Stock par exemplaire physique, occupation exclusive en base, transactions et idempotence ; détails dans database.md. |
| A10 | Proposé | Révisions de conception et installations distinctes ; restauration d’un projet sans retour arrière implicite du stock. |
| A11 | Proposé | Tests géométriques, concurrence PostgreSQL réelle et navigateur WebGL ; budgets de performance à mesurer. |
| A12 | Proposé | Accès support superadmin explicite et audité ; droits de correction de stock à valider avant implémentation correspondante. |
| X01 | Reporté | Scan, import de modèles externes, photogrammétrie, sculpture libre et reconstruction depuis photo. |
| X02 | Reporté | Espace public/grimpeur, historique personnel, défis et fonctions ludiques. |
| X03 | Reporté | Paiement et souscription autonome, application mobile native, compétitions et IA. |

## Arbitrages structurants

### Décisions issues de la recette du POC

Les dix corrections demandées autorisent le lot courant. La bibliothèque bloque les ajouts indisponibles ; le check-in reste nécessaire pour garantir la disponibilité face aux autres ouvreurs. Les dimensions et couleurs d’une pièce se renseignent dans le catalogue, pas sur son placement. Un modèle inventorié ou placé ne se modifie pas rétroactivement ; la duplication crée une variante distincte.

Les trois segments de l’exemple sont raccordés à leur création, avec des inclinaisons absolues de 0°, 30° et 0°. Une retouche ultérieure d’un pan ne propage pas encore une contrainte d’arête aux pans voisins.

Les sauvegardes sont restaurables sous réserve d’une géométrie et d’un stock compatibles. Une restauration de voie conserve les autres voies ; un conflit sur une ressource partagée entraîne un refus. Cette restauration de conception ne confirme aucune installation physique.

Les recherches fabricant ont été renouvelées mais restent bloquées au proxy. Les dimensions génériques et les trames saisies ne sont pas des références fabricant vérifiées.

### Isolation logique ou instances physiques

Une application et une base partagées permettent le catalogue commun et limitent l’exploitation du POC. Des bases ou déploiements dédiés renforcent la séparation opérationnelle mais multiplient migrations, sauvegardes et supervision. La proposition A02 doit être validée ; aucune « instance physique par salle » n’a été promise.

### Paramétrique ou maillage seul

Le paramétrique conserve des dimensions et intentions éditables, adaptées aux formes générées. Un maillage scanné apporte une forme détaillée mais ne livre pas automatiquement dimensions fiables, fixations ou surface d’appui. Le contrat sépare provenance et usage métier, plutôt que forcer une conversion de tous les scans en primitives paramétriques.

### Bibliothèque de CSG

Une opération booléenne générale n’est pas nécessaire pour un contour de pan plan avec ouvertures traversantes. Manifold est une piste pour un besoin futur de solides complexes, à évaluer par un essai dédié ; il n’est ni installé ni validé. Ne pas confondre triangulation réussie et validation géométrique des entrées.

### Réservation et réalité terrain

La transaction protège la disponibilité informatique. Elle ne prouve pas qu’une pièce a été retirée, installée ou ramenée. Les confirmations et opérations compensatrices rendent cette différence explicite et attribuable à un acteur.

## Points encore ouverts

- Direction d'architecture et POC autorisés ; détails opérationnels avant exposition externe encore à traiter.
- Références fabricants : accès documentaire bloqué, aucune cote normative vérifiée.
- Laptop et navigateur de référence, puis budgets mesurés.
- Hébergement, domaine, email et engagements de sauvegarde avant pilote externe.
- Permissions sensibles et périmètre d’une opération d’installation simultanée avant développement du stock.

Ces points ne justifient pas d’inventer des valeurs ou des intégrations. Les points d’exploitation sont traités avant qu’ils deviennent des prérequis du pilote.

## Réalisation du POC — adaptations techniques

- **POC autorisé** après présentation de l'architecture. Le porteur du projet demande une pile commune, un hébergement simple chez un fournisseur reconnu, des couches indépendantes et des retours possibles.
- **Un service web/API et PostgreSQL géré** constituent la cible de déploiement simple. Le fournisseur et les dépenses restent non décidés. Le POC ne déploie rien à l'extérieur.
- **SQL PostgreSQL et `pg` derrière un port** pour le premier lot, au lieu de Prisma. Les contraintes de stock et transactions restent explicites et testables. Une adoption d'ORM sera évaluée sur les besoins réels et ne changera pas les contrats du navigateur.
- **scrypt natif Node** pour le hachage des comptes locaux. Cette fonction reste encapsulée ; un changement d'algorithme nécessiterait compatibilité de vérification et rehash progressif, pas une réinitialisation arbitraire de tous les comptes.
- **CSS et commandes React légères** au POC ; aucune dépendance Zustand/TanStack Query/Tailwind ajoutée sans usage. L'historique réutilisable est dans editor-core.
- **Réservations par pans**, avec sérialisation des seules transactions courtes de stock dans une salle. Deux ouvreurs peuvent préparer des pans distincts, sous réserve de disponibilité des pièces. Un verrou humain global de toute la salle contredirait le parcours attendu et n'est pas retenu.
- **Paiement indépendant de l'éditeur** : Stripe Checkout/Customer Portal restent candidats futurs derrière un adaptateur. Aucune clé ni intégration réelle maintenant.

Les contraintes et le coût d'un remplacement de module sont décrits dans [hosting.md](hosting.md). Un retour de code ne restaure pas automatiquement la base ni le matériel réel.
