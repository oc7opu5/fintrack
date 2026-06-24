import { router } from "../server";
import { accountRouter } from "./account";
import { transactionRouter } from "./transaction";
import { categoryRouter } from "./category";
import { creditCardRouter } from "./credit-card";
import { loanRouter } from "./loan";
import { subscriptionRouter } from "./subscription";
import { budgetRouter } from "./budget";
import { aiRouter } from "./ai";
import { parserRouter } from "./parser";

export const appRouter = router({
  account: accountRouter,
  transaction: transactionRouter,
  category: categoryRouter,
  creditCard: creditCardRouter,
  loan: loanRouter,
  subscription: subscriptionRouter,
  budget: budgetRouter,
  ai: aiRouter,
  parser: parserRouter,
});

export type AppRouter = typeof appRouter;
