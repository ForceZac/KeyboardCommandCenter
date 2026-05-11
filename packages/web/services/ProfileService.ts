import { prisma } from '../lib/prisma';
import type { IContributorProfile, SubmissionType } from '@kcc/core';

export class ProfileService {
  async getPublicProfile(userId: string): Promise<IContributorProfile | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, image: true, createdAt: true },
    });

    if (!user) return null;

    const [totalSubmitted, totalAccepted, acceptedRows] = await Promise.all([
      prisma.submission.count({ where: { submitterId: userId } }),
      prisma.submission.count({ where: { submitterId: userId, status: 'APPROVED' } }),
      prisma.submission.findMany({
        where: { submitterId: userId, status: 'APPROVED' },
        orderBy: { reviewedAt: 'desc' },
        select: {
          type: true,
          data: true,
          reviewedAt: true,
          app: { select: { name: true } },
        },
      }),
    ]);

    const acceptanceRate = totalSubmitted > 0
      ? Math.round((totalAccepted / totalSubmitted) * 100)
      : 0;

    const acceptedContributions = acceptedRows.map((row) => {
      const data = row.data as Record<string, unknown>;
      let command = '';
      if (row.type === 'APP_REQUEST') {
        command = (data.appName as string) ?? '';
      } else {
        command = (data.command as string) ?? '';
      }

      return {
        type: row.type as SubmissionType,
        command,
        appName: row.app?.name ?? (data.appName as string) ?? '',
        date: row.reviewedAt ? row.reviewedAt.toISOString() : '',
      };
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        image: user.image,
        memberSince: user.createdAt.toISOString(),
      },
      stats: {
        totalSubmitted,
        totalAccepted,
        acceptanceRate,
      },
      acceptedContributions,
    };
  }
}
