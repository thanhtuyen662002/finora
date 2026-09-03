/**
 * Finora AI Foundation — Phase 11 Pass B Action Core Unit Test Suite
 * Tests actual execution of action-core logic via dependency injection:
 * - Authenticated personal credential lifecycle (get, save, revoke, invalid input, auth rejection)
 * - Administrative authorization boundaries (order of operations, non-admin rejection)
 * - Email lookup resolution (case-normalization, complete multi-page pagination, safety limit fail-closed, ambiguity rejection)
 * - Admin assigned credential lifecycle (get target, assign, revoke)
 * - Error sanitization contracts (safe messages, internal leak prevention)
 */

// Mock server-only package for Node.js test execution
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
try {
  const serverOnlyPath = require.resolve('server-only');
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  } as any;
} catch {
  // Ignore if server-only cannot be resolved
}

import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import {
  getMyAiCredentialMetadataCore,
  saveMyPersonalAiCredentialCore,
  revokeMyPersonalAiCredentialCore,
  checkIsAdminCore,
  getAdminAiCredentialTargetCore,
  saveAdminAssignedCredentialCore,
  revokeAdminAssignedCredentialCore,
  lookupUserByExactEmail,
  sanitizeActionError,
  isValidUuid,
  type AdminUserListingClient,
} from '../src/features/ai/credentials/action-core';
import type {
  AiCredentialRepository,
  SaveCredentialParams,
  RevokeCredentialParams,
} from '../src/lib/ai/credentials/repository';
import type {
  AiCredentialSafeMetadata,
  DatabaseCredentialSource,
} from '../src/lib/ai/credentials/types';
import { AiError } from '../src/lib/ai/errors';

export interface MockCredentialRecord {
  ownerUserId: string;
  source: DatabaseCredentialSource;
  keyHint: string;
  updatedAt: string;
  revokedAt: string | null;
}

/**
 * In-memory Mock Repository for Testing Core Action Behaviors
 */
function createMockAiCredentialRepository(initialRecords: MockCredentialRecord[] = []): {
  repo: AiCredentialRepository;
  records: MockCredentialRecord[];
  saveCalls: SaveCredentialParams[];
  revokeCalls: RevokeCredentialParams[];
} {
  const records = [...initialRecords];
  const saveCalls: SaveCredentialParams[] = [];
  const revokeCalls: RevokeCredentialParams[] = [];

  const repo = {
    async getSafeMetadata(ownerUserId: string, hasSystemKey: boolean): Promise<AiCredentialSafeMetadata> {
      const userRecords = records.filter(
        (r) => r.ownerUserId === ownerUserId && r.revokedAt === null
      );
      const personal = userRecords.find((r) => r.source === 'PERSONAL');
      const adminAssigned = userRecords.find((r) => r.source === 'ADMIN_ASSIGNED');

      let activeResolvedSource: 'PERSONAL' | 'ADMIN_ASSIGNED' | 'SYSTEM' | null = null;
      if (personal) {
        activeResolvedSource = 'PERSONAL';
      } else if (adminAssigned) {
        activeResolvedSource = 'ADMIN_ASSIGNED';
      } else if (hasSystemKey) {
        activeResolvedSource = 'SYSTEM';
      }

      return {
        activeResolvedSource,
        hasPersonalCredential: Boolean(personal),
        hasAdminAssignedCredential: Boolean(adminAssigned),
        hasSystemKeyConfigured: hasSystemKey,
        personalKeyHint: personal?.keyHint ?? null,
        personalKeyUpdatedAt: personal?.updatedAt ?? null,
        adminAssignedKeyHint: adminAssigned?.keyHint ?? null,
        adminAssignedKeyUpdatedAt: adminAssigned?.updatedAt ?? null,
      };
    },

    async saveCredential(params: SaveCredentialParams): Promise<void> {
      saveCalls.push(params);
      const existingIdx = records.findIndex(
        (r) => r.ownerUserId === params.ownerUserId && r.source === params.source
      );
      const now = new Date().toISOString();
      const newRec: MockCredentialRecord = {
        ownerUserId: params.ownerUserId,
        source: params.source,
        keyHint: params.plaintext.slice(-4),
        revokedAt: null,
        updatedAt: now,
      };
      if (existingIdx >= 0) {
        records[existingIdx] = newRec;
      } else {
        records.push(newRec);
      }
    },

    async revokeCredential(params: RevokeCredentialParams): Promise<void> {
      revokeCalls.push(params);
      for (const r of records) {
        if (
          r.ownerUserId === params.ownerUserId &&
          r.source === params.source &&
          r.revokedAt === null
        ) {
          r.revokedAt = new Date().toISOString();
        }
      }
    },
  };

  return {
    repo: repo as unknown as AiCredentialRepository,
    records,
    saveCalls,
    revokeCalls,
  };
}

async function runActionTests() {
  console.log('--- Running Phase 11 Pass B Action Core Unit Tests ---');
  let testCount = 0;

  async function it(name: string, fn: () => void | Promise<void>) {
    testCount++;
    try {
      await fn();
      console.log(`  ✓ ${testCount}. ${name}`);
    } catch (err) {
      console.error(`  ✗ ${testCount}. ${name}`);
      throw err;
    }
  }

  // 1. UUID validator
  await it('isValidUuid correctly validates standard UUIDs and rejects malformed values', () => {
    assert.strictEqual(isValidUuid(randomUUID()), true);
    assert.strictEqual(isValidUuid('not-a-uuid'), false);
    assert.strictEqual(isValidUuid(null), false);
    assert.strictEqual(isValidUuid(undefined), false);
    assert.strictEqual(isValidUuid(''), false);
  });

  // 2. getMyAiCredentialMetadataCore: Unauthenticated
  await it('getMyAiCredentialMetadataCore: rejects unauthenticated user with UNAUTHENTICATED', async () => {
    const { repo } = createMockAiCredentialRepository();
    const res = await getMyAiCredentialMetadataCore({
      getUser: async () => ({ user: null, error: new Error('Auth session missing') }),
      repo,
      hasSystemKey: true,
    });
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.code, 'UNAUTHENTICATED');
    }
  });

  // 3. getMyAiCredentialMetadataCore: Authenticated
  await it('getMyAiCredentialMetadataCore: returns safe metadata for authenticated user', async () => {
    const userId = randomUUID();
    const { repo } = createMockAiCredentialRepository();
    const res = await getMyAiCredentialMetadataCore({
      getUser: async () => ({ user: { id: userId }, error: null }),
      repo,
      hasSystemKey: true,
    });
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.metadata.hasPersonalCredential, false);
      assert.strictEqual(res.metadata.hasSystemKeyConfigured, true);
      assert.strictEqual(res.metadata.activeResolvedSource, 'SYSTEM');
    }
  });

  // 4. saveMyPersonalAiCredentialCore: Unauthenticated & Validation
  await it('saveMyPersonalAiCredentialCore: rejects unauthenticated or invalid API key inputs', async () => {
    const userId = randomUUID();
    const { repo } = createMockAiCredentialRepository();

    // Unauthenticated
    const unauthRes = await saveMyPersonalAiCredentialCore('AIzaSyValidApiKeyFormat1234567890', {
      getUser: async () => ({ user: null, error: null }),
      repo,
      hasSystemKey: false,
    });
    assert.strictEqual(unauthRes.ok, false);
    if (!unauthRes.ok) {
      assert.strictEqual(unauthRes.code, 'UNAUTHENTICATED');
    }

    // Invalid input (empty / whitespace)
    const invalidRes = await saveMyPersonalAiCredentialCore('   ', {
      getUser: async () => ({ user: { id: userId }, error: null }),
      repo,
      hasSystemKey: false,
    });
    assert.strictEqual(invalidRes.ok, false);
    if (!invalidRes.ok) {
      assert.strictEqual(invalidRes.code, 'INVALID_INPUT');
    }
  });

  // 5. saveMyPersonalAiCredentialCore: Valid Save
  await it('saveMyPersonalAiCredentialCore: successfully saves personal key and updates metadata', async () => {
    const userId = randomUUID();
    const { repo, saveCalls } = createMockAiCredentialRepository();
    const validKey = 'AIzaSyDemoPersonalKey1234567890';

    const res = await saveMyPersonalAiCredentialCore(validKey, {
      getUser: async () => ({ user: { id: userId }, error: null }),
      repo,
      hasSystemKey: true,
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(saveCalls.length, 1);
    assert.strictEqual(saveCalls[0].ownerUserId, userId);
    assert.strictEqual(saveCalls[0].source, 'PERSONAL');
    assert.strictEqual(saveCalls[0].assignedByUserId, null);
    if (res.ok) {
      assert.strictEqual(res.metadata.hasPersonalCredential, true);
      assert.strictEqual(res.metadata.personalKeyHint, '7890');
      assert.strictEqual(res.metadata.activeResolvedSource, 'PERSONAL');
    }
  });

  // 6. revokeMyPersonalAiCredentialCore
  await it('revokeMyPersonalAiCredentialCore: revokes personal key and updates metadata', async () => {
    const userId = randomUUID();
    const { repo, revokeCalls } = createMockAiCredentialRepository();

    // First save
    await saveMyPersonalAiCredentialCore('AIzaSyDemoPersonalKey1234567890', {
      getUser: async () => ({ user: { id: userId }, error: null }),
      repo,
      hasSystemKey: false,
    });

    // Revoke
    const res = await revokeMyPersonalAiCredentialCore({
      getUser: async () => ({ user: { id: userId }, error: null }),
      repo,
      hasSystemKey: false,
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(revokeCalls.length, 1);
    assert.strictEqual(revokeCalls[0].ownerUserId, userId);
    assert.strictEqual(revokeCalls[0].source, 'PERSONAL');
    if (res.ok) {
      assert.strictEqual(res.metadata.hasPersonalCredential, false);
      assert.strictEqual(res.metadata.activeResolvedSource, null);
    }
  });

  // 7. checkIsAdminCore
  await it('checkIsAdminCore: returns verified boolean strictly according to verifyAdmin', async () => {
    const nonAdmin = await checkIsAdminCore({
      verifyAdmin: async () => ({ isAdmin: false, userId: randomUUID() }),
    });
    assert.strictEqual(nonAdmin.isAdmin, false);

    const admin = await checkIsAdminCore({
      verifyAdmin: async () => ({ isAdmin: true, userId: randomUUID() }),
    });
    assert.strictEqual(admin.isAdmin, true);
  });

  // 8. lookupUserByExactEmail: Normalization and Single Match
  await it('lookupUserByExactEmail: trims, lowercases, and matches exact user email', async () => {
    const targetId = randomUUID();
    const mockAdminClient: AdminUserListingClient = {
      auth: {
        admin: {
          listUsers: async ({ page }) => {
            if (page === 1) {
              return {
                data: {
                  users: [
                    { id: randomUUID(), email: 'other@example.com' },
                    { id: targetId, email: 'Target.User@Example.COM' },
                  ],
                  nextPage: null,
                },
                error: null,
              };
            }
            return { data: { users: [], nextPage: null }, error: null };
          },
        },
      },
    };

    const matched = await lookupUserByExactEmail(mockAdminClient, '  TARGET.user@example.com  ');
    assert.ok(matched);
    assert.strictEqual(matched?.id, targetId);
    assert.strictEqual(matched?.email, 'Target.User@Example.COM');

    const notFound = await lookupUserByExactEmail(mockAdminClient, 'nonexistent@example.com');
    assert.strictEqual(notFound, null);
  });

  // 9. lookupUserByExactEmail: Pagination Traversal and Safety Limit
  await it('lookupUserByExactEmail: iterates through multiple pages and fails closed if limit reached with remaining pages', async () => {
    const targetId = randomUUID();
    let queriedPages: number[] = [];

    // 2-page complete search where target is on page 2
    const mockClientMultiPage: AdminUserListingClient = {
      auth: {
        admin: {
          listUsers: async ({ page }) => {
            queriedPages.push(page);
            if (page === 1) {
              return {
                data: {
                  users: [{ id: randomUUID(), email: 'page1@example.com' }],
                  nextPage: 2,
                },
                error: null,
              };
            }
            if (page === 2) {
              return {
                data: {
                  users: [{ id: targetId, email: 'foundonpage2@example.com' }],
                  nextPage: null,
                },
                error: null,
              };
            }
            return { data: { users: [], nextPage: null }, error: null };
          },
        },
      },
    };

    const res = await lookupUserByExactEmail(mockClientMultiPage, 'foundonpage2@example.com');
    assert.ok(res);
    assert.strictEqual(res?.id, targetId);
    assert.deepStrictEqual(queriedPages, [1, 2]);

    // Safety limit cap reached with more pages -> throws error instead of returning null
    const mockClientInfinite: AdminUserListingClient = {
      auth: {
        admin: {
          listUsers: async ({ page }) => ({
            data: {
              users: [{ id: randomUUID(), email: `user${page}@example.com` }],
              nextPage: page + 1,
            },
            error: null,
          }),
        },
      },
    };

    await assert.rejects(
      async () => {
        await lookupUserByExactEmail(mockClientInfinite, 'target@example.com', { maxPages: 3 });
      },
      (err: Error) => {
        assert.ok(err.message.includes('pagination limit reached'));
        return true;
      }
    );
  });

  // 10. lookupUserByExactEmail: Ambiguity Rejection
  await it('lookupUserByExactEmail: fails closed when ambiguous duplicate emails exist', async () => {
    const mockClientDuplicates: AdminUserListingClient = {
      auth: {
        admin: {
          listUsers: async () => ({
            data: {
              users: [
                { id: randomUUID(), email: 'duplicate@example.com' },
                { id: randomUUID(), email: 'duplicate@example.com' },
              ],
              nextPage: null,
            },
            error: null,
          }),
        },
      },
    };

    await assert.rejects(
      async () => {
        await lookupUserByExactEmail(mockClientDuplicates, 'duplicate@example.com');
      },
      (err: Error) => {
        assert.ok(err.message.includes('Ambiguous user email match detected'));
        return true;
      }
    );
  });

  // 11. getAdminAiCredentialTargetCore: Admin Authorization Gate & Order of Operations
  await it('getAdminAiCredentialTargetCore: strictly rejects non-admin callers without creating admin client or querying repo', async () => {
    let adminFactoryCalled = false;
    const { repo } = createMockAiCredentialRepository();

    const nonAdminRes = await getAdminAiCredentialTargetCore('user@example.com', {
      verifyAdmin: async () => ({ isAdmin: false, userId: randomUUID() }),
      adminClientFactory: () => {
        adminFactoryCalled = true;
        throw new Error('Admin client must never be instantiated for non-admin');
      },
      repo,
      hasSystemKey: true,
    });

    assert.strictEqual(nonAdminRes.ok, false);
    assert.strictEqual(adminFactoryCalled, false);
    if (!nonAdminRes.ok) {
      assert.strictEqual(nonAdminRes.code, 'FORBIDDEN');
    }
  });

  // 12. getAdminAiCredentialTargetCore: Target Lookup & Return Safe DTO
  await it('getAdminAiCredentialTargetCore: returns target user metadata with email in data DTO', async () => {
    const targetUserId = randomUUID();
    const adminUserId = randomUUID();
    const { repo } = createMockAiCredentialRepository();

    const mockAdminClient: AdminUserListingClient = {
      auth: {
        admin: {
          listUsers: async () => ({
            data: {
              users: [{ id: targetUserId, email: 'target@example.com' }],
              nextPage: null,
            },
            error: null,
          }),
        },
      },
    };

    const res = await getAdminAiCredentialTargetCore('target@example.com', {
      verifyAdmin: async () => ({ isAdmin: true, userId: adminUserId }),
      adminClientFactory: () => mockAdminClient,
      repo,
      hasSystemKey: false,
    });

    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.data?.email, 'target@example.com');
      assert.strictEqual((res.data as any)?.ownerUserId, undefined); // Minimal DTO verification
      assert.strictEqual(res.data?.metadata.hasPersonalCredential, false);
    }
  });

  // 13. saveAdminAssignedCredentialCore & revokeAdminAssignedCredentialCore
  await it('saveAdminAssignedCredentialCore & revokeAdminAssignedCredentialCore: securely manages assigned credentials', async () => {
    const targetUserId = randomUUID();
    const adminUserId = randomUUID();
    const { repo, saveCalls, revokeCalls } = createMockAiCredentialRepository();

    const mockAdminClient: AdminUserListingClient = {
      auth: {
        admin: {
          listUsers: async () => ({
            data: {
              users: [{ id: targetUserId, email: 'target@example.com' }],
              nextPage: null,
            },
            error: null,
          }),
        },
      },
    };

    // Save assigned credential
    const saveRes = await saveAdminAssignedCredentialCore(
      {
        targetEmail: 'target@example.com',
        plaintext: 'AIzaSyDemoAdminAssignedKey9999',
      },
      {
        verifyAdmin: async () => ({ isAdmin: true, userId: adminUserId }),
        adminClientFactory: () => mockAdminClient,
        repo,
        hasSystemKey: false,
      }
    );

    assert.strictEqual(saveRes.ok, true);
    assert.strictEqual(saveCalls.length, 1);
    assert.strictEqual(saveCalls[0].ownerUserId, targetUserId);
    assert.strictEqual(saveCalls[0].source, 'ADMIN_ASSIGNED');
    assert.strictEqual(saveCalls[0].assignedByUserId, adminUserId);
    if (saveRes.ok) {
      assert.strictEqual(saveRes.data?.metadata.hasAdminAssignedCredential, true);
      assert.strictEqual(saveRes.data?.metadata.adminAssignedKeyHint, '9999');
      assert.strictEqual(saveRes.data?.metadata.activeResolvedSource, 'ADMIN_ASSIGNED');
    }

    // Revoke assigned credential
    const revokeRes = await revokeAdminAssignedCredentialCore(
      { targetEmail: 'target@example.com' },
      {
        verifyAdmin: async () => ({ isAdmin: true, userId: adminUserId }),
        adminClientFactory: () => mockAdminClient,
        repo,
        hasSystemKey: false,
      }
    );

    assert.strictEqual(revokeRes.ok, true);
    assert.strictEqual(revokeCalls.length, 1);
    assert.strictEqual(revokeCalls[0].ownerUserId, targetUserId);
    assert.strictEqual(revokeCalls[0].source, 'ADMIN_ASSIGNED');
    if (revokeRes.ok) {
      assert.strictEqual(revokeRes.data?.metadata.hasAdminAssignedCredential, false);
      assert.strictEqual(revokeRes.data?.metadata.activeResolvedSource, null);
    }
  });

  // 14. sanitizeActionError Invariants
  await it('sanitizeActionError: handles AiError variants and generic errors safely', () => {
    // 1. Missing key ring / unavailable key
    const missingKeyErr = new AiError({
      code: 'AI_CREDENTIAL_KEY_UNAVAILABLE',
      message: 'Primary key not found in key ring',
    });
    const s1 = sanitizeActionError(missingKeyErr, 'Fallback');
    assert.strictEqual(s1.ok, false);
    if (!s1.ok) {
      assert.strictEqual(s1.code, 'AI_CREDENTIAL_CONFIG_MISSING');
      assert.strictEqual(s1.message, 'Credential encryption is not currently configured on the server.');
    }

    // 2. Corrupted credential
    const corruptErr = new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'GCM tag mismatch',
    });
    const s2 = sanitizeActionError(corruptErr, 'Fallback');
    assert.strictEqual(s2.ok, false);
    if (!s2.ok) {
      assert.strictEqual(s2.code, 'AI_CREDENTIAL_CORRUPTED');
      assert.strictEqual(s2.message, 'Stored credential integrity check failed.');
    }

    // 3. Invalid request
    const invalidErr = new AiError({
      code: 'AI_INVALID_REQUEST',
      message: 'API key must be non-empty ASCII string',
    });
    const s3 = sanitizeActionError(invalidErr, 'Fallback');
    assert.strictEqual(s3.ok, false);
    if (!s3.ok) {
      assert.strictEqual(s3.code, 'INVALID_INPUT');
      assert.strictEqual(s3.message, 'API key must be non-empty ASCII string');
    }

    // 4. Raw error / unhandled exception
    const rawErr = new Error('Database connection pool timeout on port 5432');
    const s4 = sanitizeActionError(rawErr, 'An unexpected server error occurred.');
    assert.strictEqual(s4.ok, false);
    if (!s4.ok) {
      assert.strictEqual(s4.code, 'OPERATION_FAILED');
      assert.strictEqual(s4.message, 'An unexpected server error occurred.');
      assert.strictEqual(s4.message.includes('5432'), false);
    }
  });

  console.log(`\nAll ${testCount} Phase 11 Pass B Action Core Unit Tests passed successfully!`);
}

runActionTests().catch((err) => {
  console.error('\nAction Core Unit Tests failed:', err);
  process.exit(1);
});
