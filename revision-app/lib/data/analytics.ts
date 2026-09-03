import { prisma } from "@/lib/prisma";

export async function getAllTopicProfiles(examId: string) {
  return prisma.topicPerformanceProfile.findMany({
    where: { topic: { chapter: { subject: { examId } } } },
    orderBy: { revisionPriorityScore: "desc" },
    include: { topic: { include: { chapter: { include: { subject: true } } } } },
  });
}

export async function getTopAttentionTopics(examId: string, limit = 2) {
  return prisma.topicPerformanceProfile.findMany({
    where: {
      attentionLevel: { in: ["high_attention", "needs_attention"] },
      topic: { chapter: { subject: { examId } } },
    },
    orderBy: { revisionPriorityScore: "desc" },
    take: limit,
    include: { topic: true },
  });
}
