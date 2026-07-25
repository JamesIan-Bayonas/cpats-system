// File: src/app/dashboard/pr/evaluate-business/page.tsx
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Role, PRStatus } from '@prisma/client';
import { AuthUser } from '@/shared/session';
import {
  PageShell,
  StageHeader,
  Card,
  ErrorBanner,
  SuccessBanner,
  FieldLabel,
  FieldError,
  inputClass,
  CheckItem,
  ReviewWorkspace,
  DecisionButtonGroup,
  ActionButton,
  QueueTask,
} from '@/components/ui/WorkflowUI';

interface ZodSubErrors {
  _errors?: string[];
}

interface ZodFormErrors {
  prId?: ZodSubErrors;
  action?: ZodSubErrors;
  remarks?: ZodSubErrors;
}

interface PendingPRNode {
  id: string;
  justification: string;
  status: PRStatus;
  createdAt: string;
  department: { code: string; name: string };
}

export default function BusinessOfficeEvaluationPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeUser, setActiveUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState<boolean>(true);

  const [targetPrId, setTargetPrId] = useState<string>('');
  const [evaluationAction, setEvaluationAction] = useState<'APPROVE' | 'DECLINE' | 'RETURN_FOR_CORRECTION' | ''>('');
  const [remarks, setRemarks] = useState<string>('');

  const [necessityVerified, setNecessityVerified] = useState<boolean>(false);
  const [budgetAvailable, setBudgetAvailable] = useState<boolean>(false);

  const [activeQueue, setActiveQueue] = useState<PendingPRNode[]>([]);
  const [queueLoading, setQueueLoading] = useState<boolean>(true);

  const [systemError, setSystemError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ZodFormErrors | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setActiveUser(res.data);
          syncWorkspaceQueue(res.data.role);
        }
      })
      .catch(() => setSystemError('Could not load active session. Please refresh.'))
      .finally(() => setUserLoading(false));
  }, []);

  const syncWorkspaceQueue = async (userRole: Role) => {
    try {
      const response = await fetch('/api/pr/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: userRole }),
      });
      const resData = await response.json();
      if (response.ok) {
        const evaluationTasks = (resData.data || []).filter(
          (item: PendingPRNode) => item.status === PRStatus.Pending_Business_Approval
        );
        setActiveQueue(evaluationTasks);
      }
    } catch (err) {
      console.error('Queue sync failed:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  const handleEvaluationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError(null);
    setFieldErrors(null);
    setSuccessMessage(null);

    if (!activeUser || activeUser.role !== Role.Business_Office) {
      setSystemError('Only Business Office personnel can evaluate Purchase Requests.');
      return;
    }

    if (!necessityVerified || !budgetAvailable) {
      setSystemError('Please confirm both verification checks before recording your decision.');
      return;
    }

    if (!evaluationAction) {
      setSystemError('Please select an evaluation action (Approve, Return for Correction, or Decline).');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/pr/evaluate-business', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prId: targetPrId, action: evaluationAction, remarks }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 422 && result.errors) {
            setFieldErrors(result.errors);
            throw new Error('Please review highlighted fields.');
          }
          throw new Error(result.error || 'A transaction exception occurred while recording your decision.');
        }

        setSuccessMessage(`Evaluation committed successfully. Request status updated.`);

        setTargetPrId('');
        setEvaluationAction('');
        setRemarks('');
        setNecessityVerified(false);
        setBudgetAvailable(false);

        await syncWorkspaceQueue(activeUser.role);
        router.refresh();
      } catch (err: any) {
        setSystemError(err.message || 'Something went wrong. Please try again.');
      }
    });
  };

  if (userLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm font-medium text-slate-500 font-sans">
        Loading session context…
      </div>
    );
  }

  if (!activeUser || activeUser.role !== Role.Business_Office) {
    return (
      <Card className="max-w-md w-full text-center mx-auto my-12">
        <h2 className="text-rose-700 font-bold text-sm">Access Restricted</h2>
        <p className="text-slate-500 text-xs mt-2 leading-relaxed">
          Your account ({activeUser?.role.replace(/_/g, ' ') || 'Guest'}) is not authorized for Business Office evaluation.
        </p>
      </Card>
    );
  }

  const queueTasks: QueueTask[] = activeQueue.map((task) => ({
    id: task.id,
    title: task.justification,
    subtitle: task.department.code,
    dateLabel: new Date(task.createdAt).toLocaleDateString(),
  }));

  return (
    <PageShell>
      <StageHeader
        eyebrow="Step 2 of 6 · Business Office Evaluation"
        title="Business Office Evaluation"
        description="Verify item necessity and departmental budget availability before approving, returning, or declining purchase requisitions."
        meta={{ label: 'Signed in as', value: activeUser.email }}
      />

      {systemError && <ErrorBanner>{systemError}</ErrorBanner>}
      {successMessage && <SuccessBanner>{successMessage}</SuccessBanner>}

      <ReviewWorkspace
        queueTitle="Requests Awaiting Evaluation"
        tasks={queueTasks}
        loading={queueLoading}
        emptyMessage="No purchase requests are currently waiting for evaluation."
        selectedId={targetPrId}
        onSelect={setTargetPrId}
      >
        <form onSubmit={handleEvaluationSubmit} className="space-y-6">
          <div>
            <FieldLabel>Target Purchase Request (UUID)</FieldLabel>
            <input
              type="text"
              required
              readOnly
              className={`${inputClass(!!fieldErrors?.prId)} font-mono bg-slate-100 text-slate-600 cursor-not-allowed`}
              placeholder="Select a request from the queue list on the left…"
              value={targetPrId}
            />
            {fieldErrors?.prId?._errors && <FieldError>{fieldErrors.prId._errors[0]}</FieldError>}
          </div>

          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Required Financial Verification Clearances
            </span>
            <div className="space-y-2.5">
              <CheckItem
                id="gate-necessity"
                checked={necessityVerified}
                onChange={setNecessityVerified}
                label="Verify Purchase Necessity"
                description="I have reviewed the item specifications and confirmed departmental requirement alignment."
              />
              <CheckItem
                id="gate-budget"
                checked={budgetAvailable}
                onChange={setBudgetAvailable}
                label="Check Budget Availability"
                description="Operational balance matrices have been checked; funds are present under the department allocation code."
              />
            </div>
          </div>

          <div>
            <FieldLabel>Evaluation Decision</FieldLabel>
            <DecisionButtonGroup value={evaluationAction} onChange={setEvaluationAction} />
            {fieldErrors?.action?._errors && <FieldError>{fieldErrors.action._errors[0]}</FieldError>}
          </div>

          <div>
            <FieldLabel>Audit Evaluation Remarks</FieldLabel>
            <textarea
              required
              rows={3}
              className={`${inputClass(!!fieldErrors?.remarks)} h-auto py-2.5`}
              placeholder="Document evaluation rationale for audit trail transparency…"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
            {fieldErrors?.remarks?._errors && <FieldError>{fieldErrors.remarks._errors[0]}</FieldError>}
          </div>

          <div className="border-t border-slate-200/80 pt-4 flex justify-end">
            <ActionButton type="submit" disabled={isPending}>
              {isPending ? 'Saving Decision…' : 'Submit Evaluation'}
            </ActionButton>
          </div>
        </form>
      </ReviewWorkspace>
    </PageShell>
  );
}