import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
    });

    // Create default categories
    const defaultCategories = [
      { name: "Salary", type: "INCOME" as const, icon: "💰", isDefault: true },
      { name: "Freelance", type: "INCOME" as const, icon: "💻", isDefault: true },
      { name: "Investment", type: "INCOME" as const, icon: "📈", isDefault: true },
      { name: "Food & Dining", type: "EXPENSE" as const, icon: "🍔", isDefault: true },
      { name: "Transportation", type: "EXPENSE" as const, icon: "🚗", isDefault: true },
      { name: "Shopping", type: "EXPENSE" as const, icon: "🛍️", isDefault: true },
      { name: "Bills & Utilities", type: "EXPENSE" as const, icon: "📱", isDefault: true },
      { name: "Entertainment", type: "EXPENSE" as const, icon: "🎬", isDefault: true },
      { name: "Healthcare", type: "EXPENSE" as const, icon: "🏥", isDefault: true },
      { name: "Education", type: "EXPENSE" as const, icon: "📚", isDefault: true },
      { name: "Subscriptions", type: "EXPENSE" as const, icon: "🔄", isDefault: true },
      { name: "Other", type: "EXPENSE" as const, icon: "📦", isDefault: true },
    ];

    await db.category.createMany({
      data: defaultCategories.map((cat) => ({
        ...cat,
        userId: user.id,
      })),
    });

    return NextResponse.json(
      { message: "Account created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
