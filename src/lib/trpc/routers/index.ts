import { router } from "../server";
import { accountRouter } from "./account";
import { transactionRouter } from "./transaction";
import { categoryRouter } from "./category";
import { creditCardRouter } from "./credit-card";
import { loanRouter } from "./loan";
import { subscriptionRouter } from "./subscription";
import { budgetRouter } from "./budget";

export const appRouter = router({
  account: accountRouter,
  transaction: transactionRouter,
  category: categoryRouter,
  creditCard: creditCardRouter,
  loan: loanRouter,
  subscription: subscriptionRouter,
  budget: budgetRouter,
});

export type AppRouter = typeof appRouter;
