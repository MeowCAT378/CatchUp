type ParticipantSession = { id: string; token: string }; const key = (code: string) => `catchup:participant:${code}`;
export const participantFor = (code: string): ParticipantSession | null => { try { const value = sessionStorage.getItem(key(code)); return value ? JSON.parse(value) as ParticipantSession : null; } catch { return null; } };
export const saveParticipant = (code: string, participant: ParticipantSession) => sessionStorage.setItem(key(code), JSON.stringify(participant)); export const clearParticipant = (code: string) => sessionStorage.removeItem(key(code));
