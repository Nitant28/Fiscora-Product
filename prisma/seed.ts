import { runEnterpriseSeeds } from "../apps/api/src/lib/seed";

runEnterpriseSeeds()
  .then(() => {
    console.log("Seed complete");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
