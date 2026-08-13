/**
 * Utilitários de payload — sem dependência de implementação de storage.
 */
import { ACTOR_DERIVED_AUDIT_FIELDS } from './constants.js';

export const stripActorFieldsFromPayload = (input = {}) => {
  const copy = { ...input };
  for (const field of ACTOR_DERIVED_AUDIT_FIELDS) delete copy[field];
  delete copy.configuredAt;
  delete copy.approvedAt;
  delete copy.suspendedAt;
  delete copy.revokedAt;
  return copy;
};
