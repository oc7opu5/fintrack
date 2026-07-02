import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_CURRENCIES } from "../src/lib/currency";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create demo user
  const passwordHash = await bcrypt.hash("password123", 12);
  const user = await prisma.user.upsert({
    where: { email: "demo@fintrack.app" },
    update: {},
    create: {
      email: "demo@fintrack.app",
      name: "Demo User",
      passwordHash,
      currency: "BDT",
      timezone: "Asia/Dhaka",
    },
  });

  console.log("Created demo user:", user.email);

  // Create default categories
  const categories = [
    { name: "Salary", type: "INCOME" as const, icon: "💰", isDefault: true },
    {
      name: "Freelance",
      type: "INCOME" as const,
      icon: "💻",
      isDefault: true,
    },
    {
      name: "Investment",
      type: "INCOME" as const,
      icon: "📈",
      isDefault: true,
    },
    {
      name: "Other Income",
      type: "INCOME" as const,
      icon: "💵",
      isDefault: true,
    },
    {
      name: "Food & Dining",
      type: "EXPENSE" as const,
      icon: "🍔",
      isDefault: true,
    },
    {
      name: "Transportation",
      type: "EXPENSE" as const,
      icon: "🚗",
      isDefault: true,
    },
    {
      name: "Shopping",
      type: "EXPENSE" as const,
      icon: "🛍️",
      isDefault: true,
    },
    {
      name: "Bills & Utilities",
      type: "EXPENSE" as const,
      icon: "📱",
      isDefault: true,
    },
    {
      name: "Entertainment",
      type: "EXPENSE" as const,
      icon: "🎬",
      isDefault: true,
    },
    {
      name: "Healthcare",
      type: "EXPENSE" as const,
      icon: "🏥",
      isDefault: true,
    },
    {
      name: "Education",
      type: "EXPENSE" as const,
      icon: "📚",
      isDefault: true,
    },
    {
      name: "Subscriptions",
      type: "EXPENSE" as const,
      icon: "🔄",
      isDefault: true,
    },
    {
      name: "Personal Care",
      type: "EXPENSE" as const,
      icon: "💈",
      isDefault: true,
    },
    {
      name: "Other",
      type: "EXPENSE" as const,
      icon: "📦",
      isDefault: true,
    },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: {
        userId_name_type: {
          userId: user.id,
          name: category.name,
          type: category.type,
        },
      },
      update: {},
      create: {
        ...category,
        userId: user.id,
      },
    });
  }

  console.log("Created default categories");

  // Create demo accounts
  const bkashAccount = await prisma.account.upsert({
    where: {
      userId_name_type: {
        userId: user.id,
        name: "My bKash",
        type: "BKASH",
      },
    },
    update: {},
    create: {
      userId: user.id,
      name: "My bKash",
      type: "BKASH",
      balance: 5000,
      isDefault: true,
    },
  });

  const bankAccount = await prisma.account.upsert({
    where: {
      userId_name_type: {
        userId: user.id,
        name: "DBBL Bank",
        type: "BANK_ACCOUNT",
      },
    },
    update: {},
    create: {
      userId: user.id,
      name: "DBBL Bank",
      type: "BANK_ACCOUNT",
      balance: 25000,
    },
  });

  console.log("Created demo accounts");

  // Create demo transactions
  const now = new Date();
  const salaryCategory = await prisma.category.findFirst({
    where: { userId: user.id, name: "Salary", type: "INCOME" },
  });
  const foodCategory = await prisma.category.findFirst({
    where: { userId: user.id, name: "Food & Dining", type: "EXPENSE" },
  });
  const transportCategory = await prisma.category.findFirst({
    where: { userId: user.id, name: "Transportation", type: "EXPENSE" },
  });

  const transactions = [
    {
      userId: user.id,
      accountId: bankAccount.id,
      categoryId: salaryCategory?.id,
      type: "INCOME" as const,
      amount: 50000,
      description: "Monthly Salary",
      date: new Date(now.getFullYear(), now.getMonth(), 1),
    },
    {
      userId: user.id,
      accountId: bkashAccount.id,
      categoryId: foodCategory?.id,
      type: "EXPENSE" as const,
      amount: 450,
      description: "Lunch at office",
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2),
    },
    {
      userId: user.id,
      accountId: bkashAccount.id,
      categoryId: transportCategory?.id,
      type: "EXPENSE" as const,
      amount: 200,
      description: "Uber ride to meeting",
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
    },
  ];

  for (const transaction of transactions) {
    await prisma.transaction.create({ data: transaction });
  }

  console.log("Created demo transactions");

  // Create demo subscription
  await prisma.subscription.create({
    data: {
      userId: user.id,
      name: "Netflix",
      amount: 650,
      billingCycle: "MONTHLY",
      status: "ACTIVE",
      startDate: new Date(now.getFullYear(), now.getMonth() - 3, 1),
      nextBillingDate: new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1
      ),
      category: "Entertainment",
    },
  });

  console.log("Created demo subscription");

  // Seed currencies
  for (const c of DEFAULT_CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: c.code },
      create: { code: c.code, name: c.name, symbol: c.symbol, rateToBase: c.rateToBase, isBase: c.isBase },
      update: {},
    });
  }
  console.log("Seeded currencies: BDT, USD, CAD");

  console.log("Seeding complete!");
  console.log("\nDemo credentials:");
  console.log("Email: demo@fintrack.app");
  console.log("Password: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
