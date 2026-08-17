import { ActivityType, RoomPhase, RoomStatus } from '@prisma/client';

type ActivityLifecycle = {
  minPrompts: number;
  maxPrompts?: number;
  usesChoices: boolean;
  requiresCorrectChoice: boolean;
  canSubmitChoice: boolean;
  canSubmitWord: boolean;
  canReveal: boolean;
  canAdvance: boolean;
  scoresAnswers: boolean;
};

const lifecycles: Record<ActivityType, ActivityLifecycle> = {
  [ActivityType.QUIZ]: {
    minPrompts: 1,
    usesChoices: true,
    requiresCorrectChoice: true,
    canSubmitChoice: true,
    canSubmitWord: false,
    canReveal: true,
    canAdvance: true,
    scoresAnswers: true,
  },
  [ActivityType.POLL]: {
    minPrompts: 1,
    usesChoices: true,
    requiresCorrectChoice: false,
    canSubmitChoice: true,
    canSubmitWord: false,
    canReveal: false,
    canAdvance: false,
    scoresAnswers: false,
  },
  [ActivityType.WORD_CLOUD]: {
    minPrompts: 1,
    maxPrompts: 1,
    usesChoices: false,
    requiresCorrectChoice: false,
    canSubmitChoice: false,
    canSubmitWord: true,
    canReveal: false,
    canAdvance: false,
    scoresAnswers: false,
  },
};

export function activityLifecycle(type: ActivityType) {
  return lifecycles[type];
}

export function roomActions(
  type: ActivityType,
  status: RoomStatus,
  phase: RoomPhase,
) {
  const lifecycle = activityLifecycle(type);
  const active = status === RoomStatus.ACTIVE && phase === RoomPhase.ACTIVE;
  return {
    canStart: status === RoomStatus.LOBBY && phase === RoomPhase.WAITING,
    canSubmitChoice: lifecycle.canSubmitChoice && active,
    canSubmitWord: lifecycle.canSubmitWord && active,
    canReveal: lifecycle.canReveal && active,
    canAdvance:
      lifecycle.canAdvance &&
      status === RoomStatus.ACTIVE &&
      phase === RoomPhase.REVEALED,
    canComplete:
      status === RoomStatus.ACTIVE &&
      (phase === RoomPhase.ACTIVE ||
        (lifecycle.canReveal && phase === RoomPhase.REVEALED)),
  };
}

export function canConfigurePrompt(type: ActivityType, count: number) {
  const { maxPrompts } = activityLifecycle(type);
  return maxPrompts === undefined || count < maxPrompts;
}

export function hasUsablePrompts(type: ActivityType, count: number) {
  const { minPrompts, maxPrompts } = activityLifecycle(type);
  return (
    count >= minPrompts && (maxPrompts === undefined || count <= maxPrompts)
  );
}

export function promptRequirementError(type: ActivityType) {
  return type === ActivityType.WORD_CLOUD
    ? {
        code: 'WORD_CLOUD_PROMPT_REQUIRED',
        message: 'Word cloud needs one prompt',
      }
    : {
        code: 'VALIDATION_ERROR',
        message: 'Activity needs at least one question',
      };
}
