export function claimableWhere(now = new Date()) {
  return {
    eligibleStates: ['PENDING', 'RETRY'],
    now: new Date(now).toISOString()
  };
}

export function createLease({ workerId, leaseSeconds = 60, now = new Date() }) {
  if (!workerId) throw new Error('WORKER_ID_REQUIRED');
  if (!Number.isInteger(leaseSeconds) || leaseSeconds <= 0) throw new Error('INVALID_LEASE_DURATION');
  const expires = new Date(new Date(now).getTime() + leaseSeconds * 1000);
  return Object.freeze({ lease_owner: workerId, lease_expires_at: expires.toISOString() });
}

export function isLeaseExpired(leaseExpiresAt, now = new Date()) {
  if (!leaseExpiresAt) return true;
  return new Date(leaseExpiresAt).getTime() <= new Date(now).getTime();
}
