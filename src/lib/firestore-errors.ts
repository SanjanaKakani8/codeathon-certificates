
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

export function formatFirestoreError(error: unknown, operationType: OperationType, path: string | null, auth: any): string {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  
  if (errInfo.error.includes('permission-denied')) {
    return `ACCESS DENIED: Your account (${errInfo.authInfo.email || 'Not Signed In'}) does not have administrator privileges for the "${path}" collection. Please contact the system owner.`;
  }
  
  return JSON.stringify(errInfo);
}
