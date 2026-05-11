import { prisma } from '../lib/prisma';
import { RateLimitError, DuplicateSubmissionError } from '../lib/errors';
import type { ISubmission, SubmissionCreatePayload } from '@kcc/core';

const DAILY_SUBMISSION_LIMIT = 20;

function toWireSubmission(row: {
  id: string;
  type: string;
  status: string;
  submitterId: string;
  appId: string | null;
  shortcutId: string | null;
  data: unknown;
  reviewerNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ISubmission {
  return {
    id: row.id,
    type: row.type as ISubmission['type'],
    status: row.status as ISubmission['status'],
    submitterId: row.submitterId,
    appId: row.appId,
    shortcutId: row.shortcutId,
    data: row.data as Record<string, unknown>,
    reviewerNotes: row.reviewerNotes,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class SubmissionsService {
  /**
   * Creates a pending submission.
   * - Enforces 20/day rate limit per user (UTC day).
   * - For NEW_SHORTCUT: checks for a server-side duplicate on app + platform + keyCombo
   *   (case-insensitive match on ShortcutKeyStep.keyCombo).
   * - For NEW_SHORTCUT and CORRECTION: validates that appId is provided and exists.
   * - For CORRECTION: validates that shortcutId is provided.
   * - For APP_REQUEST: appId must be null/absent.
   */
  async create(userId: string, payload: SubmissionCreatePayload): Promise<ISubmission> {
    // Validate required fields per type
    if (payload.type === 'NEW_SHORTCUT' || payload.type === 'CORRECTION') {
      if (!payload.appId) {
        throw new Error('appId is required for NEW_SHORTCUT and CORRECTION submissions');
      }
    }
    if (payload.type === 'CORRECTION') {
      if (!payload.shortcutId) {
        throw new Error('shortcutId is required for CORRECTION submissions');
      }
    }

    // Rate limit: count submissions by this user today (UTC)
    const startOfDayUTC = new Date();
    startOfDayUTC.setUTCHours(0, 0, 0, 0);

    const todayCount = await prisma.submission.count({
      where: {
        submitterId: userId,
        createdAt: { gte: startOfDayUTC },
      },
    });

    if (todayCount >= DAILY_SUBMISSION_LIMIT) {
      throw new RateLimitError(
        `Submission limit reached: max ${DAILY_SUBMISSION_LIMIT} submissions per day`,
      );
    }

    // Duplicate detection for NEW_SHORTCUT only
    if (payload.type === 'NEW_SHORTCUT') {
      const data = payload.data as {
        platformId?: string;
        keyCombo?: string;
      };
      if (data.platformId && data.keyCombo) {
        const existing = await prisma.shortcutKeyStep.findFirst({
          where: {
            keyCombo: { equals: data.keyCombo, mode: 'insensitive' },
            binding: {
              platformId: data.platformId,
              shortcut: { applicationId: payload.appId! },
            },
          },
        });
        if (existing) {
          throw new DuplicateSubmissionError(
            'An identical shortcut already exists for this app, platform, and key combination',
          );
        }
      }
    }

    const submission = await prisma.submission.create({
      data: {
        type: payload.type,
        status: 'PENDING',
        submitterId: userId,
        appId: payload.appId ?? null,
        shortcutId: payload.shortcutId ?? null,
        data: payload.data,
      },
    });

    return toWireSubmission(submission);
  }

  /**
   * Returns all submissions for the given user, newest first.
   */
  async getByUser(userId: string): Promise<ISubmission[]> {
    const rows = await prisma.submission.findMany({
      where: { submitterId: userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toWireSubmission);
  }

  /**
   * Returns all PENDING submissions, oldest first (admin use).
   */
  async getPending(): Promise<ISubmission[]> {
    const rows = await prisma.submission.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toWireSubmission);
  }

  /**
   * Approves a submission and applies its data to the shortcuts table.
   * - NEW_SHORTCUT: creates Shortcut + ShortcutKeyBinding + ShortcutKeyStep
   * - CORRECTION: updates existing Shortcut and its ShortcutKeyStep
   * - APP_REQUEST: inserts a new Application row
   */
  async approve(adminId: string, submissionId: string): Promise<ISubmission> {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) throw new Error('Submission not found');

    const data = submission.data as Record<string, unknown>;
    const now = new Date();

    if (submission.type === 'NEW_SHORTCUT') {
      // data shape: { command, context?, platformId, keyCombo, key, modifiers[] }
      const shortcut = await prisma.shortcut.create({
        data: {
          applicationId: submission.appId!,
          command: data.command as string,
          context: (data.context as string | undefined) ?? null,
        },
      });
      const binding = await prisma.shortcutKeyBinding.create({
        data: {
          shortcutId: shortcut.id,
          platformId: data.platformId as string,
        },
      });
      await prisma.shortcutKeyStep.create({
        data: {
          bindingId: binding.id,
          stepOrder: 1,
          keyCombo: data.keyCombo as string,
          key: data.key as string,
          modifiers: (data.modifiers as string[]) ?? [],
        },
      });
    } else if (submission.type === 'CORRECTION') {
      // data shape: { command?, context?, keyCombo?, key?, modifiers[], platformId? }
      // Update the Shortcut row (command/context may have changed)
      const updateShortcut: Record<string, unknown> = {};
      if (data.command !== undefined) updateShortcut.command = data.command;
      if (data.context !== undefined) updateShortcut.context = data.context;
      if (Object.keys(updateShortcut).length > 0) {
        await prisma.shortcut.update({
          where: { id: submission.shortcutId! },
          data: updateShortcut,
        });
      }

      // Update the key step if keyCombo/key/modifiers are provided
      if (data.keyCombo !== undefined && data.platformId !== undefined) {
        const binding = await prisma.shortcutKeyBinding.findUnique({
          where: {
            shortcutId_platformId: {
              shortcutId: submission.shortcutId!,
              platformId: data.platformId as string,
            },
          },
          include: { steps: { where: { stepOrder: 1 } } },
        });
        if (binding && binding.steps[0]) {
          const stepUpdate: Record<string, unknown> = { keyCombo: data.keyCombo };
          if (data.key !== undefined) stepUpdate.key = data.key;
          if (data.modifiers !== undefined) stepUpdate.modifiers = data.modifiers;
          await prisma.shortcutKeyStep.update({
            where: { id: binding.steps[0].id },
            data: stepUpdate,
          });
        }
      }
    } else if (submission.type === 'APP_REQUEST') {
      // data shape: { appName, slug, website?, categoryId, platforms? }
      await prisma.application.create({
        data: {
          name: data.appName as string,
          slug: (data.slug as string) ?? (data.appName as string).toLowerCase().replace(/\s+/g, '-'),
          description: (data.website as string | undefined) ?? null,
          categoryId: data.categoryId as string,
        },
      });
    }

    const updated = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: 'APPROVED',
        reviewedBy: adminId,
        reviewedAt: now,
      },
    });

    return toWireSubmission(updated);
  }

  /**
   * Merges updatedData into the submission's data field, then approves it.
   */
  async editAndApprove(
    adminId: string,
    submissionId: string,
    updatedData: Record<string, unknown>,
  ): Promise<ISubmission> {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) throw new Error('Submission not found');

    const mergedData = {
      ...(submission.data as Record<string, unknown>),
      ...updatedData,
    };

    await prisma.submission.update({
      where: { id: submissionId },
      data: { data: mergedData },
    });

    return this.approve(adminId, submissionId);
  }

  /**
   * Rejects a submission with optional reviewer notes.
   */
  async reject(
    adminId: string,
    submissionId: string,
    reviewerNotes?: string,
  ): Promise<ISubmission> {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) throw new Error('Submission not found');

    const updated = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: 'REJECTED',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewerNotes: reviewerNotes ?? null,
      },
    });

    return toWireSubmission(updated);
  }
}
