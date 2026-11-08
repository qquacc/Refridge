import { getMongoStore } from "../backend/mongo-store.mjs";
import { backfillMembershipDates } from "../backend/accounts.mjs";
if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is required. Run with your production environment configured."); process.exit(1);
}
try {
  const store = await getMongoStore();
  const result = await store.mutate((state) => backfillMembershipDates(state));
  const verified = backfillMembershipDates(structuredClone(await store.read()), Date.now());
  console.log(JSON.stringify({ total: result.total, updated: result.updated, missingAfterVerification: verified.updated }));
  process.exit(verified.updated ? 1 : 0);
} catch { console.error("Membership backfill could not complete. Check database access; no connection details are printed."); process.exit(1); }
