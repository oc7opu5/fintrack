import { router } from "../server";
import { accountRouter } from "./account";
import { transactionRouter } from "./transaction";

export const appRouter = router({
  account: accountRouter,
  transaction: transactionRouter,
});

export type AppRouter = typeof appRouter;
