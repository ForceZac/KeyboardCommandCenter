'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import type { IAdminSubmission } from '@kcc/core';
import { useAdminAction } from '../hooks/useAdminAction';
import SubmissionTypeBadge from './SubmissionTypeBadge';
import CorrectionDiffView from './CorrectionDiffView';
import DuplicateBadge from './DuplicateBadge';

interface Props {
  submission: IAdminSubmission;
}

function DataFields({ data, type }: { data: Record<string, unknown>; type: string }) {
  if (type === 'APP_REQUEST') {
    return (
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-gray-500 dark:text-gray-400">App Name</dt>
        <dd className="text-gray-900 dark:text-gray-100">{String(data.appName ?? '—')}</dd>
        {data.website != null && (
          <>
            <dt className="text-gray-500 dark:text-gray-400">Website</dt>
            <dd className="text-gray-900 dark:text-gray-100">{String(data.website)}</dd>
          </>
        )}
        {data.categoryId != null && (
          <>
            <dt className="text-gray-500 dark:text-gray-400">Category</dt>
            <dd className="text-gray-900 dark:text-gray-100">{String(data.categoryId)}</dd>
          </>
        )}
      </dl>
    );
  }

  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      {data.command != null && (
        <>
          <dt className="text-gray-500 dark:text-gray-400">Command</dt>
          <dd className="text-gray-900 dark:text-gray-100">{String(data.command)}</dd>
        </>
      )}
      {data.keyCombo != null && (
        <>
          <dt className="text-gray-500 dark:text-gray-400">Key Combo</dt>
          <dd className="font-mono text-gray-900 dark:text-gray-100">{String(data.keyCombo)}</dd>
        </>
      )}
      {data.context != null && (
        <>
          <dt className="text-gray-500 dark:text-gray-400">Context</dt>
          <dd className="text-gray-900 dark:text-gray-100">{String(data.context)}</dd>
        </>
      )}
      {data.platformId != null && (
        <>
          <dt className="text-gray-500 dark:text-gray-400">Platform</dt>
          <dd className="text-gray-900 dark:text-gray-100">{String(data.platformId)}</dd>
        </>
      )}
    </dl>
  );
}

export default function SubmissionCard({ submission }: Props) {
  const action = useAdminAction();
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>(() => {
    const d = submission.data;
    const initial: Record<string, string> = {};
    for (const key of Object.keys(d)) {
      if (d[key] != null) initial[key] = String(d[key]);
    }
    return initial;
  });
  const [dismissed, setDismissed] = useState(false);

  const handleApprove = () => {
    action.mutate(
      { id: submission.id, action: { action: 'approve' } },
      { onSuccess: () => setDismissed(true) },
    );
  };

  const handleReject = () => {
    action.mutate(
      { id: submission.id, action: { action: 'reject', reviewerNotes: rejectReason || undefined } },
      { onSuccess: () => setDismissed(true) },
    );
  };

  const handleEditApprove = () => {
    action.mutate(
      { id: submission.id, action: { action: 'edit-and-approve', data: editData } },
      { onSuccess: () => setDismissed(true) },
    );
  };

  if (dismissed) return null;

  const isCorrection = submission.type === 'CORRECTION';
  const hasDuplicate = submission.data.serverFlaggedDuplicate === true;

  return (
    <div
      className={clsx(
        'rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-opacity',
        action.isPending && 'opacity-50 pointer-events-none',
      )}
      data-testid="submission-card"
    >
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <SubmissionTypeBadge type={submission.type} />
        {hasDuplicate && submission.appSlug && (
          <DuplicateBadge shortcutId={submission.shortcutId ?? ''} appSlug={submission.appSlug} />
        )}
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          {new Date(submission.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Submitter + App */}
      <div className="mt-2 flex items-center gap-2">
        {submission.submitterImage && (
          <img
            src={submission.submitterImage}
            alt=""
            className="w-5 h-5 rounded-full"
          />
        )}
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {submission.submitterName ?? 'Unknown user'}
        </span>
        {submission.appName && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            · {submission.appName}
          </span>
        )}
      </div>

      {/* Data fields or Diff */}
      {isCorrection && submission.originalShortcut ? (
        <CorrectionDiffView original={submission.originalShortcut} proposed={submission.data} />
      ) : (
        <DataFields data={submission.data} type={submission.type} />
      )}

      {/* Action error */}
      {action.isError && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          Action failed: {action.error.message}
        </p>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <button
          onClick={handleApprove}
          disabled={action.isPending}
          className="px-3 py-1.5 text-sm font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          data-testid="approve-btn"
        >
          Approve
        </button>

        <button
          onClick={() => setShowEdit(!showEdit)}
          className="px-3 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
          data-testid="edit-approve-toggle"
        >
          {showEdit ? 'Cancel Edit' : 'Edit & Approve'}
        </button>

        <button
          onClick={() => setShowReject(!showReject)}
          className="px-3 py-1.5 text-sm font-medium rounded bg-red-600 text-white hover:bg-red-700"
          data-testid="reject-toggle"
        >
          {showReject ? 'Cancel' : 'Reject'}
        </button>
      </div>

      {/* Reject form */}
      {showReject && (
        <div className="mt-3" data-testid="reject-form">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (optional)"
            rows={2}
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
          <button
            onClick={handleReject}
            disabled={action.isPending}
            className="mt-2 px-3 py-1.5 text-sm font-medium rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            data-testid="reject-confirm"
          >
            Confirm Reject
          </button>
        </div>
      )}

      {/* Edit & Approve form */}
      {showEdit && (
        <div className="mt-3 space-y-2" data-testid="edit-form">
          {Object.entries(editData).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <label className="w-24 text-xs text-gray-500 dark:text-gray-400 shrink-0">
                {key}
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => setEditData((prev) => ({ ...prev, [key]: e.target.value }))}
                className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          ))}
          <button
            onClick={handleEditApprove}
            disabled={action.isPending}
            className="px-3 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            data-testid="edit-approve-confirm"
          >
            Save & Approve
          </button>
        </div>
      )}
    </div>
  );
}
