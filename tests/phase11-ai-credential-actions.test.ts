/**
 * Finora AI Foundation — Phase 11 Pass B Action Core Unit Test Suite
 * Tests actual execution of action-core logic via dependency injection:
 * - Authenticated personal credential lifecycle (get, save, revoke, invalid input, auth rejection)
 * - Administrative authorization boundaries (order of operations, non-admin rejection)
 * - Deferred repository factory creation (zero service-role repo before auth / admin / validation)
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
 * In-memory Mock Repository for Testing Core Action Behaviors with factory call tracking
 */
function createMockAiCredentialRepository(
  initialRecords: MockCredentialRecord[] = [],
  eventLog?: string[]
): {
  repo: AiCredentialRepository;
  repoFactory: () => AiCredentialRepository;
  getRepoFactoryCalls: () => number;
  records: MockCredentialRecord[];
  saveCalls: SaveCredentialParams[];
  revokeCalls: RevokeCredentialParams[];
} {
  const records = [...initialRecords];
  const saveCalls: SaveCredentialParams[] = [];
  const revokeCalls: RevokeCredentialParams[] = [];
  let repoFactoryCalls = 0;

  const repo = {
    async getSafeMetadata(ownerUserId: string, hasSystemKey: boolean): Promise<AiCredentialSafeMetadata> {
      eventLog?.push('getSafeMetadata');
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
      eventLog?.push('saveCredential');
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
      eventLog?.push('revokeCredential');
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
    repoFactory: () => {
      eventLog?.push('repoFactory');
      repoFactoryCalls++;
      return repo as unknown as AiCredentialRepository;
    },
    getRepoFactoryCalls: () => repoFactoryCalls,
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

  // 2. PERSONAL-ORDER-01: unauthenticated metadata -> repoFactory = 0
  await it('PERSONAL-ORDER-01: unauthenticated metadata -> repoFactory = 0', async () => {
    const { repoFactory, getRepoFactoryCalls } = createMockAiCredentialRepository();
    const res = await getMyAiCredentialMetadataCore({
      getUser: async () => ({ user: null, error: new Error('Auth session missing') }),
      repoFactory,
      hasSystemKey: true,
    });
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.code, 'UNAUTHENTICATED');
    }
    assert.strictEqual(getRepoFactoryCalls(), 0);
  });

  // 3. PERSONAL-ORDER-02: unauthenticated save -> repoFactory = 0
  await it('PERSONAL-ORDER-02: unauthenticated save -> repoFactory = 0', async () => {
    const { repoFactory, getRepoFactoryCalls } = createMockAiCredentialRepository();
    const res = await saveMyPersonalAiCredentialCore('AIzaSyValidApiKeyFormat1234567890', {
      getUser: async () => ({ user: null, error: null }),
      repoFactory,
      hasSystemKey: false,
    });
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.code, 'UNAUTHENTICATED');
    }
    assert.strictEqual(getRepoFactoryCalls(), 0);
  });

  // 4. PERSONAL-ORDER-03: invalid plaintext after authenticated user -> repoFactory = 0
  await it('PERSONAL-ORDER-03: invalid plaintext after authenticated user -> repoFactory = 0', async () => {
    const userId = randomUUID();
    const { repoFactory, getRepoFactoryCalls } = createMockAiCredentialRepository();

    const invalidRes = await saveMyPersonalAiCredentialCore('   ', {
      getUser: async () => ({ user: { id: userId }, error: null }),
      repoFactory,
      hasSystemKey: false,
    });
    assert.strictEqual(invalidRes.ok, false);
    if (!invalidRes.ok) {
      assert.strictEqual(invalidRes.code, 'INVALID_INPUT');
    }
    assert.strictEqual(getRepoFactoryCalls(), 0);
  });

  // 5. PERSONAL-ORDER-04: authenticated valid save -> repoFactory = 1
  await it('PERSONAL-ORDER-04: authenticated valid save -> repoFactory = 1', async () => {
    const userId = randomUUID();
    const { repoFactory, getRepoFactoryCalls, saveCalls } = createMockAiCredentialRepository();
    const validKey = 'AIzaSyDemoPersonalKey1234567890';

    const res = await saveMyPersonalAiCredentialCore(validKey, {
      getUser: async () => ({ user: { id: userId }, error: null }),
      repoFactory,
      hasSystemKey: true,
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(getRepoFactoryCalls(), 1);
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

  // 6. PERSONAL-ORDER-05: unauthenticated revoke -> repoFactory = 0
  await it('PERSONAL-ORDER-05: unauthenticated revoke -> repoFactory = 0', async () => {
    const { repoFactory, getRepoFactoryCalls } = createMockAiCredentialRepository();
    const res = await revokeMyPersonalAiCredentialCore({
      getUser: async () => ({ user: null, error: new Error('Missing session') }),
      repoFactory,
      hasSystemKey: false,
    });
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.code, 'UNAUTHENTICATED');
    }
    assert.strictEqual(getRepoFactoryCalls(), 0);
  });

  // 7. getMyAiCredentialMetadataCore: Authenticated
  await it('getMyAiCredentialMetadataCore: returns safe metadata for authenticated user', async () => {
    const userId = randomUUID();
    const { repoFactory, getRepoFactoryCalls } = createMockAiCredentialRepository();
    const res = await getMyAiCredentialMetadataCore({
      getUser: async () => ({ user: { id: userId }, error: null }),
      repoFactory,
      hasSystemKey: true,
    });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(getRepoFactoryCalls(), 1);
    if (res.ok) {
      assert.strictEqual(res.metadata.hasPersonalCredential, false);
      assert.strictEqual(res.metadata.hasSystemKeyConfigured, true);
      assert.strictEqual(res.metadata.activeResolvedSource, 'SYSTEM');
    }
  });

  // 8. revokeMyPersonalAiCredentialCore: Authenticated
  await it('revokeMyPersonalAiCredentialCore: revokes personal key and updates metadata', async () => {
    const userId = randomUUID();
    const { repoFactory, getRepoFactoryCalls, revokeCalls } = createMockAiCredentialRepository();

    // First save
    await saveMyPersonalAiCredentialCore('AIzaSyDemoPersonalKey1234567890', {
      getUser: async () => ({ user: { id: userId }, error: null }),
      repoFactory,
      hasSystemKey: false,
    });

    // Revoke
    const res = await revokeMyPersonalAiCredentialCore({
      getUser: async () => ({ user: { id: userId }, error: null }),
      repoFactory,
      hasSystemKey: false,
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(getRepoFactoryCalls(), 2); // 1 for save + 1 for revoke
    assert.strictEqual(revokeCalls.length, 1);
    assert.strictEqual(revokeCalls[0].ownerUserId, userId);
    assert.strictEqual(revokeCalls[0].source, 'PERSONAL');
    if (res.ok) {
      assert.strictEqual(res.metadata.hasPersonalCredential, false);
      assert.strictEqual(res.metadata.activeResolvedSource, null);
    }
  });

  // 9. checkIsAdminCore
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

  // 10. lookupUserByExactEmail: Normalization and Single Match
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

  // 11. lookupUserByExactEmail: Pagination Traversal and Safety Limit
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

  // 12. lookupUserByExactEmail: Ambiguity Rejection
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

  // 13. ADMIN-ORDER-01: non-admin lookup -> adminClientFactory = 0, repoFactory = 0
  await it('ADMIN-ORDER-01: non-admin lookup -> adminClientFactory = 0, repoFactory = 0', async () => {
    let adminClientFactoryCalls = 0;
    const { repoFactory, getRepoFactoryCalls } = createMockAiCredentialRepository();

    const nonAdminRes = await getAdminAiCredentialTargetCore('user@example.com', {
      verifyAdmin: async () => ({ isAdmin: false, userId: randomUUID() }),
      adminClientFactory: () => {
        adminClientFactoryCalls++;
        throw new Error('Must not be called');
      },
      repoFactory,
      hasSystemKey: true,
    });

    assert.strictEqual(nonAdminRes.ok, false);
    assert.strictEqual(adminClientFactoryCalls, 0);
    assert.strictEqual(getRepoFactoryCalls(), 0);
    if (!nonAdminRes.ok) {
      assert.strictEqual(nonAdminRes.code, 'FORBIDDEN');
    }
  });

  // 14. ADMIN-ORDER-02: non-admin save -> adminClientFactory = 0, repoFactory = 0
  await it('ADMIN-ORDER-02: non-admin save -> adminClientFactory = 0, repoFactory = 0', async () => {
    let adminClientFactoryCalls = 0;
    const { repoFactory, getRepoFactoryCalls } = createMockAiCredentialRepository();

    const nonAdminRes = await saveAdminAssignedCredentialCore(
      { targetEmail: 'user@example.com', plaintext: 'AIzaSyDemoKey1234567890' },
      {
        verifyAdmin: async () => ({ isAdmin: false, userId: randomUUID() }),
        adminClientFactory: () => {
          adminClientFactoryCalls++;
          throw new Error('Must not be called');
        },
        repoFactory,
        hasSystemKey: true,
      }
    );

    assert.strictEqual(nonAdminRes.ok, false);
    assert.strictEqual(adminClientFactoryCalls, 0);
    assert.strictEqual(getRepoFactoryCalls(), 0);
    if (!nonAdminRes.ok) {
      assert.strictEqual(nonAdminRes.code, 'FORBIDDEN');
    }
  });

  // 15. ADMIN-ORDER-03: non-admin revoke -> adminClientFactory = 0, repoFactory = 0
  await it('ADMIN-ORDER-03: non-admin revoke -> adminClientFactory = 0, repoFactory = 0', async () => {
    let adminClientFactoryCalls = 0;
    const { repoFactory, getRepoFactoryCalls } = createMockAiCredentialRepository();

    const nonAdminRes = await revokeAdminAssignedCredentialCore(
      { targetEmail: 'user@example.com' },
      {
        verifyAdmin: async () => ({ isAdmin: false, userId: randomUUID() }),
        adminClientFactory: () => {
          adminClientFactoryCalls++;
          throw new Error('Must not be called');
        },
        repoFactory,
        hasSystemKey: true,
      }
    );

    assert.strictEqual(nonAdminRes.ok, false);
    assert.strictEqual(adminClientFactoryCalls, 0);
    assert.strictEqual(getRepoFactoryCalls(), 0);
    if (!nonAdminRes.ok) {
      assert.strictEqual(nonAdminRes.code, 'FORBIDDEN');
    }
  });

  // 16. ADMIN-ORDER-04: target NOT_FOUND -> repoFactory = 0
  await it('ADMIN-ORDER-04: target NOT_FOUND -> repoFactory = 0', async () => {
    let adminClientFactoryCalls = 0;
    const { repoFactory, getRepoFactoryCalls } = createMockAiCredentialRepository();

    const mockAdminClient: AdminUserListingClient = {
      auth: {
        admin: {
          listUsers: async () => ({
            data: { users: [], nextPage: null },
            error: null,
          }),
        },
      },
    };

    const res = await getAdminAiCredentialTargetCore('nonexistent@example.com', {
      verifyAdmin: async () => ({ isAdmin: true, userId: randomUUID() }),
      adminClientFactory: () => {
        adminClientFactoryCalls++;
        return mockAdminClient;
      },
      repoFactory,
      hasSystemKey: false,
    });

    assert.strictEqual(res.ok, false);
    assert.strictEqual(adminClientFactoryCalls, 1);
    assert.strictEqual(getRepoFactoryCalls(), 0);
    if (!res.ok) {
      assert.strictEqual(res.code, 'NOT_FOUND');
    }
  });

  // 17. ADMIN-ORDER-05: pagination incomplete/failure -> repoFactory = 0
  await it('ADMIN-ORDER-05: pagination incomplete/failure -> repoFactory = 0', async () => {
    let adminClientFactoryCalls = 0;
    const { repoFactory, getRepoFactoryCalls } = createMockAiCredentialRepository();

    const mockClientFailing: AdminUserListingClient = {
      auth: {
        admin: {
          listUsers: async () => ({
            data: null,
            error: { message: 'Database connection failed' },
          }),
        },
      },
    };

    const res = await getAdminAiCredentialTargetCore('user@example.com', {
      verifyAdmin: async () => ({ isAdmin: true, userId: randomUUID() }),
      adminClientFactory: () => {
        adminClientFactoryCalls++;
        return mockClientFailing;
      },
      repoFactory,
      hasSystemKey: false,
    });

    assert.strictEqual(res.ok, false);
    assert.strictEqual(adminClientFactoryCalls, 1);
    assert.strictEqual(getRepoFactoryCalls(), 0);
  });

  // 18. ADMIN-ORDER-06: authorized target lookup success -> verifyAdmin -> adminClientFactory -> lookup -> repoFactory -> repo operation
  await it('ADMIN-ORDER-06: authorized target lookup success -> asserts exact chronological event order', async () => {
    const targetUserId = randomUUID();
    const adminUserId = randomUUID();
    const eventLog: string[] = [];

    const { repoFactory, getRepoFactoryCalls } = createMockAiCredentialRepository([], eventLog);

    const mockAdminClient: AdminUserListingClient = {
      auth: {
        admin: {
          listUsers: async () => {
            eventLog.push('listUsers');
            return {
              data: {
                users: [{ id: targetUserId, email: 'target@example.com' }],
                nextPage: null,
              },
              error: null,
            };
          },
        },
      },
    };

    const res = await getAdminAiCredentialTargetCore('target@example.com', {
      verifyAdmin: async () => {
        eventLog.push('verifyAdmin');
        return { isAdmin: true, userId: adminUserId };
      },
      adminClientFactory: () => {
        eventLog.push('adminClientFactory');
        return mockAdminClient;
      },
      repoFactory,
      hasSystemKey: false,
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(getRepoFactoryCalls(), 1);
    assert.deepStrictEqual(eventLog, [
      'verifyAdmin',
      'adminClientFactory',
      'listUsers',
      'repoFactory',
      'getSafeMetadata',
    ]);
    if (res.ok) {
      assert.strictEqual(res.data?.email, 'target@example.com');
      assert.strictEqual((res.data as any)?.ownerUserId, undefined); // Minimal DTO verification
      assert.strictEqual(res.data?.metadata.hasPersonalCredential, false);
    }
  });

  // 19. ADMIN-ORDER-07: authorized target save success -> verifyAdmin -> adminClientFactory -> lookup -> repoFactory -> save -> getSafeMetadata
  await it('ADMIN-ORDER-07: authorized target save success -> asserts exact chronological event order', async () => {
    const targetUserId = randomUUID();
    const adminUserId = randomUUID();
    const eventLog: string[] = [];

    const { repoFactory, getRepoFactoryCalls, saveCalls } = createMockAiCredentialRepository([], eventLog);

    const mockAdminClient: AdminUserListingClient = {
      auth: {
        admin: {
          listUsers: async () => {
            eventLog.push('listUsers');
            return {
              data: {
                users: [{ id: targetUserId, email: 'target@example.com' }],
                nextPage: null,
              },
              error: null,
            };
          },
        },
      },
    };

    const saveRes = await saveAdminAssignedCredentialCore(
      {
        targetEmail: 'target@example.com',
        plaintext: 'AIzaSyDemoAdminAssignedKey9999',
      },
      {
        verifyAdmin: async () => {
          eventLog.push('verifyAdmin');
          return { isAdmin: true, userId: adminUserId };
        },
        adminClientFactory: () => {
          eventLog.push('adminClientFactory');
          return mockAdminClient;
        },
        repoFactory,
        hasSystemKey: false,
      }
    );

    assert.strictEqual(saveRes.ok, true);
    assert.strictEqual(getRepoFactoryCalls(), 1);
    assert.strictEqual(saveCalls.length, 1);
    assert.strictEqual(saveCalls[0].ownerUserId, targetUserId);
    assert.strictEqual(saveCalls[0].source, 'ADMIN_ASSIGNED');
    assert.strictEqual(saveCalls[0].assignedByUserId, adminUserId);
    assert.deepStrictEqual(eventLog, [
      'verifyAdmin',
      'adminClientFactory',
      'listUsers',
      'repoFactory',
      'saveCredential',
      'getSafeMetadata',
    ]);
    if (saveRes.ok) {
      assert.strictEqual(saveRes.data?.metadata.hasAdminAssignedCredential, true);
      assert.strictEqual(saveRes.data?.metadata.adminAssignedKeyHint, '9999');
      assert.strictEqual(saveRes.data?.metadata.activeResolvedSource, 'ADMIN_ASSIGNED');
    }
  });

  // 20. ADMIN-ORDER-08: authorized target revoke success -> verifyAdmin -> adminClientFactory -> lookup -> repoFactory -> revoke -> getSafeMetadata
  await it('ADMIN-ORDER-08: authorized target revoke success -> asserts exact chronological event order', async () => {
    const targetUserId = randomUUID();
    const adminUserId = randomUUID();
    const eventLog: string[] = [];

    const { repoFactory, getRepoFactoryCalls, revokeCalls } = createMockAiCredentialRepository([], eventLog);

    const mockAdminClient: AdminUserListingClient = {
      auth: {
        admin: {
          listUsers: async () => {
            eventLog.push('listUsers');
            return {
              data: {
                users: [{ id: targetUserId, email: 'target@example.com' }],
                nextPage: null,
              },
              error: null,
            };
          },
        },
      },
    };

    const revokeRes = await revokeAdminAssignedCredentialCore(
      { targetEmail: 'target@example.com' },
      {
        verifyAdmin: async () => {
          eventLog.push('verifyAdmin');
          return { isAdmin: true, userId: adminUserId };
        },
        adminClientFactory: () => {
          eventLog.push('adminClientFactory');
          return mockAdminClient;
        },
        repoFactory,
        hasSystemKey: false,
      }
    );

    assert.strictEqual(revokeRes.ok, true);
    assert.strictEqual(getRepoFactoryCalls(), 1);
    assert.strictEqual(revokeCalls.length, 1);
    assert.strictEqual(revokeCalls[0].ownerUserId, targetUserId);
    assert.strictEqual(revokeCalls[0].source, 'ADMIN_ASSIGNED');
    assert.deepStrictEqual(eventLog, [
      'verifyAdmin',
      'adminClientFactory',
      'listUsers',
      'repoFactory',
      'revokeCredential',
      'getSafeMetadata',
    ]);
    if (revokeRes.ok) {
      assert.strictEqual(revokeRes.data?.metadata.hasAdminAssignedCredential, false);
      assert.strictEqual(revokeRes.data?.metadata.activeResolvedSource, null);
    }
  });

  // 21. sanitizeActionError Invariants
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
