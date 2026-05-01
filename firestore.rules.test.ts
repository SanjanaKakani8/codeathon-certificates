import { describe, it, beforeEach, expect, afterAll } from 'vitest';
import { 
  initializeTestEnvironment, 
  RulesTestEnvironment, 
  assertFails, 
  assertSucceeds 
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, getDoc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

describe('Firestore Security Rules', () => {
  beforeEach(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'codeathon-2k26-test',
      firestore: {
        rules: readFileSync('DRAFT_firestore.rules', 'utf8')
      }
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('restricts public access to all documents', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthedDb, 'participants/any')));
    await assertFails(getDocs(collection(unauthedDb, 'participants')));
  });

  it('allows admins to manage participants', async () => {
    const adminId = 'admin_user';
    const authedDb = testEnv.authenticatedContext(adminId, { email_verified: true }).firestore();
    
    // Setup admin record (Note: rules don't allow creating admins via SDK, but here we mock the DB state)
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'admins', adminId), { active: true });
    });

    await assertSucceeds(setDoc(doc(authedDb, 'participants/p1'), {
      name: 'John Doe',
      email: 'john@example.com',
      rollNo: '2026-001',
      role: 'Participant',
      event: 'Web Development'
    }));
  });

  it('allows users to see their own records by email', async () => {
    const userId = 'user_123';
    const email = 'user@example.com';
    const authedDb = testEnv.authenticatedContext(userId, { email: email, email_verified: true }).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'participants/p2'), {
        name: 'User One',
        email: email,
        rollNo: '2026-002',
        role: 'Winner',
        event: 'Hackathon'
      });
    });

    await assertSucceeds(getDoc(doc(authedDb, 'participants/p2')));
  });

  it('rejects field injection in updates', async () => {
    const adminId = 'admin_user';
    const authedDb = testEnv.authenticatedContext(adminId, { email_verified: true }).firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'admins', adminId), { active: true });
      await setDoc(doc(context.firestore(), 'participants/p1'), {
        name: 'John Doe',
        email: 'john@example.com',
        rollNo: '2026-001',
        role: 'Participant',
        event: 'Web Development'
      });
    });

    // Attempt to add a field not in the allowed list
    await assertFails(setDoc(doc(authedDb, 'participants/p1'), {
      name: 'John Doe',
      email: 'john@example.com',
      rollNo: '2026-001',
      role: 'Participant',
      event: 'Web Development',
      maliciousField: 'hacked'
    }));
  });
});
