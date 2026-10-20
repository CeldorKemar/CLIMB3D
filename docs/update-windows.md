# Mettre le POC à jour sur Windows 11

Conserver l’ancien dossier jusqu’à avoir vérifié la nouvelle version. Les salles sauvegardées sont dans PostgreSQL, dans le volume Docker `infra_climbed_postgres`, et non dans les fichiers du ZIP. Un brouillon non sauvegardé dans le navigateur doit être sauvegardé avant de fermer l’ancienne version.

1. Dans le terminal qui fait tourner l’application, faire **Ctrl+C**. Laisser Docker Desktop ouvert.
2. Télécharger [la branche du POC en ZIP](https://github.com/CeldorKemar/CLIMB3D/archive/refs/heads/poc/climbed-3d.zip), puis choisir **Extraire tout** vers un nouveau dossier.
3. Ouvrir le dossier extrait qui contient `package.json`, `apps`, `packages` et `scripts`. Dans la barre d’adresse de l’Explorateur, taper `powershell` puis Entrée.
4. Si le fichier `.env` de l’ancienne installation a été personnalisé, le copier dans le nouveau dossier avant la préparation. Avec les paramètres par défaut, laisser la préparation le créer.
5. Exécuter les commandes suivantes une par une ; attendre la fin de chacune :

```powershell
npm.cmd ci
npm.cmd run setup:local
npm.cmd run dev
```

La préparation applique aussi les nouvelles migrations de base de données. Elle ne réinitialise ni les scènes existantes ni les stocks. Si elle échoue, conserver le premier message d’erreur et arrêter à cette étape.

6. Garder ce terminal ouvert et ouvrir le port web indiqué par Vite dans le navigateur du PC. Les comptes fictifs locaux sont inchangés.

Ne pas lancer simultanément les deux versions. Ne pas supprimer le volume PostgreSQL et ne pas utiliser `docker compose down -v` : cette option supprime les données. Conserver aussi l’ancien `.env` si une configuration a été personnalisée.

Les migrations sont additives et les anciennes versions restent dans Git. Un retour au code précédent doit néanmoins être vérifié avec les nouvelles données avant de travailler dessus. Les sauvegardes nommées de l’application restaurent la conception ; elles ne remplacent pas une sauvegarde PostgreSQL pour se protéger d’une perte du volume.


La mise à jour des modes de fixation ajoute des champs facultatifs aux documents de salle, sans migration SQL. Le nouveau code accepte les anciens documents. Après sauvegarde de trous préparés ou d’autorisations de modification, l’ancien code strict peut refuser ces nouveaux champs : un retour à cette version demande aussi la sauvegarde PostgreSQL prise avant mise à jour. Garder seulement l’ancien dossier du code ne sauvegarde pas les données.
