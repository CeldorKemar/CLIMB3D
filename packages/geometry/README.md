# @climbed/geometry

Géométrie paramétrique et validations du POC. Les fonctions produisent des `BufferGeometry` Three.js sans dépendance à React, à l’API ou au stock. Le consommateur est responsable de `dispose()` lorsqu’une géométrie n’est plus utilisée.

- `createWallGeometry(wall)` : solide extrudé derrière la face locale XY, largeur centrée en X, hauteur depuis Y=0, face avant Z=0. Les ouvertures rectangulaires sont traversantes. Les trous touchant un bord ou un autre trou sont refusés.
- `createModelGeometry(model)` : solide centré en XY, base Z=0, dimensions exactes. La coupelle et le bac ont un intérieur concave et un fond réel. Les formes sont génériques ; aucune spécification fabricant n’est prétendue.
- `isPointOnWall(wall, point)` : appartenance à la face avant, hors ouvertures, avec tolérance numérique de 0,1 mm ; ne contrôle pas l’empreinte entière d’un objet.
- `isPointOnModelSurface(model, point, rotation)` : point sur une facette de support, avec alignement de l’axe local +Z de l’élément sur une normale de surface. La face arrière de montage est exclue. Les normales lissées du rendu peuvent différer légèrement de celles des facettes, d’où une tolérance angulaire.
- `getWorldPose(scene, placementId)` : composition des transformations locales, avec erreurs explicites en cas de support manquant ou de cycle.
- `quaternionFromWallAngles(inclination, yaw)` et `getWallAngles(rotation)` : degrés ; inclinaison positive vers +Z. Le couple représente les rotations sans roulis, y compris un toit à 90°.
- `validateScene(scene)` : schéma, références, unicité, relations autorisées, surfaces d’ancrage et ouvertures ; retourne une liste de messages, vide si valide.

Les validations de surface contrôlent l’ancrage et son orientation. Elles ne constituent ni une détection générale des collisions ni une validation mécanique de fixation. L’extension à des assets scannés utilisera une autre représentation de support versionnée ; les indices de triangles de ces géométries dérivées ne sont pas persistés.

Vérifications depuis la racine : `npm run typecheck -w @climbed/geometry` et `npx vitest run packages/geometry/tests`.
