import { describe, it, expect, beforeAll, beforeEach } from "vitest";

import { prisma } from "@/lib/prisma";
import { setupTestDatabase, resetDatabase } from "../setup/testDb";
import {
  createUser,
  createExam,
  createFullAvailability,
  createSyllabus,
  createQuestionSet,
  createQuestion,
  createMockTest,
  startAttempt,
} from "../fixtures/factories";
import { getCurrentUserExam, getExamOwnedByUser } from "@/lib/data/exam";
import { getQuestionSetDetail, getQuestionSetsForExam } from "@/lib/data/questionSets";
import { getAttemptForUser, getAttemptHistory } from "@/lib/data/mockTestAttempt";
import { getLatestSubmittedAttempt } from "@/lib/data/mockTests";
import { getAllTopicProfiles } from "@/lib/data/analytics";

/**
 * Data isolation between accounts. Every one of these is a Critical-severity check:
 * a leak here would show one candidate another's exam, questions, or results.
 * Two fully-populated users are built, then every scoped read is called as user A
 * against user B's data.
 */
describe("Cross-user data isolation", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  async function createPopulatedUser(label: string) {
    const user = await createUser({ email: `${label}-${Date.now()}@test.local`, name: label });
    const exam = await createExam(user.id, { name: `${label}'s exam` });
    await createFullAvailability(exam.id);
    const { topics } = await createSyllabus(exam.id, [{ name: `${label} topic` }]);
    const set = await createQuestionSet(exam.id, `${label} question set`);
    const question = await createQuestion(set.id, {
      text: `${label} question`,
      options: ["Right", "Wrong"],
      correctIndex: 0,
      topicId: topics[0].id,
    });
    const mockTest = await createMockTest(exam.id, [question.id], { name: `${label} test` });
    const attempt = await startAttempt(mockTest.id, user.id);
    await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: { status: "submitted", submittedAt: new Date(), score: 2, accuracy: 100 },
    });
    await prisma.topicPerformanceProfile.create({
      data: { topicId: topics[0].id, questionsAttempted: 5, correctAnswers: 5, accuracy: 100 },
    });

    return { user, exam, set, question, mockTest, attempt, topic: topics[0] };
  }

  it("never returns another user's exam from getCurrentUserExam", async () => {
    const alice = await createPopulatedUser("alice");
    const bob = await createPopulatedUser("bob");

    const aliceExam = await getCurrentUserExam(alice.user.id);
    const bobExam = await getCurrentUserExam(bob.user.id);

    expect(aliceExam?.id).toBe(alice.exam.id);
    expect(bobExam?.id).toBe(bob.exam.id);
    expect(aliceExam?.id).not.toBe(bob.exam.id);
  });

  it("refuses to hand a user another user's exam by id", async () => {
    const alice = await createPopulatedUser("alice");
    const bob = await createPopulatedUser("bob");

    expect(await getExamOwnedByUser(bob.exam.id, alice.user.id)).toBeNull();
    expect(await getExamOwnedByUser(alice.exam.id, alice.user.id)).not.toBeNull();
  });

  it("refuses to hand a user another user's question set", async () => {
    const alice = await createPopulatedUser("alice");
    const bob = await createPopulatedUser("bob");

    expect(await getQuestionSetDetail(bob.set.id, alice.user.id)).toBeNull();
    expect(await getQuestionSetDetail(alice.set.id, alice.user.id)).not.toBeNull();
  });

  it("scopes the question-set list to the requesting user's own exam", async () => {
    const alice = await createPopulatedUser("alice");
    const bob = await createPopulatedUser("bob");

    const aliceSets = await getQuestionSetsForExam(alice.exam.id);

    expect(aliceSets.map((s) => s.id)).toContain(alice.set.id);
    expect(aliceSets.map((s) => s.id)).not.toContain(bob.set.id);
  });

  it("refuses to hand a user another user's test attempt", async () => {
    const alice = await createPopulatedUser("alice");
    const bob = await createPopulatedUser("bob");

    expect(await getAttemptForUser(bob.attempt.id, alice.user.id)).toBeNull();
    expect(await getAttemptForUser(alice.attempt.id, alice.user.id)).not.toBeNull();
  });

  it("scopes attempt history to the requesting user", async () => {
    const alice = await createPopulatedUser("alice");
    const bob = await createPopulatedUser("bob");

    const aliceHistory = await getAttemptHistory(alice.user.id, alice.exam.id);
    const bobHistory = await getAttemptHistory(bob.user.id, bob.exam.id);

    expect(aliceHistory.map((a) => a.id)).toEqual([alice.attempt.id]);
    expect(bobHistory.map((a) => a.id)).toEqual([bob.attempt.id]);
  });

  it("returns nothing when asking for another user's history with your own id", async () => {
    const alice = await createPopulatedUser("alice");
    const bob = await createPopulatedUser("bob");

    // Alice's id combined with Bob's exam id must yield nothing at all.
    expect(await getAttemptHistory(alice.user.id, bob.exam.id)).toHaveLength(0);
  });

  it("scopes the latest submitted attempt to the requesting user", async () => {
    const alice = await createPopulatedUser("alice");
    const bob = await createPopulatedUser("bob");

    const latestForAlice = await getLatestSubmittedAttempt(alice.user.id);
    expect(latestForAlice?.id).toBe(alice.attempt.id);
    expect(latestForAlice?.id).not.toBe(bob.attempt.id);
  });

  it("scopes topic performance profiles to the requesting user's exam", async () => {
    const alice = await createPopulatedUser("alice");
    const bob = await createPopulatedUser("bob");

    const aliceProfiles = await getAllTopicProfiles(alice.exam.id);

    expect(aliceProfiles.map((p) => p.topicId)).toContain(alice.topic.id);
    expect(aliceProfiles.map((p) => p.topicId)).not.toContain(bob.topic.id);
  });

  it("keeps syllabus trees separate", async () => {
    const alice = await createPopulatedUser("alice");
    await createPopulatedUser("bob"); // must exist in the DB so the negative assertion below is meaningful

    const aliceExam = await getCurrentUserExam(alice.user.id);
    const topicNames = aliceExam!.subjects.flatMap((s) => s.chapters.flatMap((c) => c.topics.map((t) => t.name)));

    expect(topicNames).toContain("alice topic");
    expect(topicNames).not.toContain("bob topic");
  });
});
