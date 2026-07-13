import {
  getBackupCenterStatus,
  seedInitialBackupIfEmpty,
} from "../src/services/backupEngine";

async function main() {
  await seedInitialBackupIfEmpty();

  const status = await getBackupCenterStatus();

  console.log(JSON.stringify(status, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
