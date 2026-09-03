import { prisma } from "@/lib/prisma";

export async function getLatestSubmittedAttempt(userId: string) {
  return prisma.testAttempt.findFirst({
    where: { userId, status: { in: ["submitted", "auto_submitted"] } },
    orderBy: { submittedAt: "desc" },
    include: { mockTest: true },
  });
}
