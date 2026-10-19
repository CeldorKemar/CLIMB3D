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
