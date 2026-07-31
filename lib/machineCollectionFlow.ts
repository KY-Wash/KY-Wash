export type CollectionStatus = 'waiting' | 'coming' | 'collected';

export interface MachineCollectionStatusEntry {
  status: CollectionStatus;
  user: string;
}

export interface CollectionActionState {
  showOnTheWay: boolean;
  showClothesCollected: boolean;
  showPendingNotice: boolean;
  pendingNotice: string;
}

export function buildMachineCollectionKey(machineType: string, machineId: string | number): string {
  return `${machineType}-${machineId}`;
}

export function getCollectionActionState(
  machine: {
    status?: string;
    type?: string;
    id?: string | number;
    userStudentId?: string | null;
    collectionStatus?: MachineCollectionStatusEntry | null;
  },
  currentUserId?: string | null,
  collectionState?: MachineCollectionStatusEntry | null
): CollectionActionState {
  if (machine?.status !== 'pending-collection') {
    return {
      showOnTheWay: false,
      showClothesCollected: false,
      showPendingNotice: false,
      pendingNotice: '',
    };
  }

  const startedByCurrentUser = Boolean(currentUserId && machine.userStudentId && machine.userStudentId === currentUserId);
  const effectiveCollectionState = collectionState ?? machine.collectionStatus ?? null;
  const pendingUser = effectiveCollectionState?.status === 'coming' ? effectiveCollectionState.user : null;

  if (startedByCurrentUser) {
    return {
      showOnTheWay: true,
      showClothesCollected: true,
      showPendingNotice: false,
      pendingNotice: '',
    };
  }

  if (effectiveCollectionState?.status === 'coming') {
    return {
      showOnTheWay: true,
      showClothesCollected: true,
      showPendingNotice: true,
      pendingNotice: pendingUser
        ? `${pendingUser} is on the way to collect clothes.`
        : 'Pending collection — please collect your clothes.',
    };
  }

  return {
    showOnTheWay: false,
    showClothesCollected: false,
    showPendingNotice: true,
    pendingNotice: pendingUser
      ? `${pendingUser} is on the way to collect clothes.`
      : 'Pending collection — please collect your clothes.',
  };
}

export function applyMachineCollectionUpdate(
  state: {
    machines?: Array<{
      id: string | number;
      type: string;
      status: string;
      timeLeft?: number;
      mode?: string;
      userStudentId?: string;
      userPhone?: string;
    }>;
    machineCollectionStatus?: Record<string, MachineCollectionStatusEntry>;
  },
  data: {
    machineId: string | number;
    machineType: string;
    status: 'coming' | 'collected';
    studentId?: string;
  }
): { key: string; machine?: any; status: 'coming' | 'collected' } {
  const key = buildMachineCollectionKey(data.machineType, data.machineId);
  if (!state.machineCollectionStatus) {
    state.machineCollectionStatus = {};
  }

  const machine = state.machines?.find((m) => String(m.id) === String(data.machineId) && m.type === data.machineType);

  if (data.status === 'coming') {
    state.machineCollectionStatus[key] = { status: 'coming', user: data.studentId || '' };
    return { key, machine, status: 'coming' };
  }

  if (machine) {
    machine.status = 'available';
    machine.timeLeft = 0;
    machine.mode = '';
    machine.userStudentId = '';
    machine.userPhone = '';
  }

  delete state.machineCollectionStatus[key];
  return { key, machine, status: 'collected' };
}
