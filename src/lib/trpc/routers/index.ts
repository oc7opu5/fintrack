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
import { aiSettingsRouter } from "./ai-settings";
import { userRouter } from "./user";
import { currencyRouter } from "./currency";
import { debtRouter } from "./debt";
import { journalRouter } from "./journal";
import { insightRouter } from "./insight";

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
  aiSettings: aiSettingsRouter,
  user: userRouter,
  currency: currencyRouter,
  debt: debtRouter,
  journal: journalRouter,
  insight: insightRouter,
});

export type AppRouter = typeof appRouter;
