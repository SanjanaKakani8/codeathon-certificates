/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Participant {
  id: string;
  name: string;
  email: string;
  rollNo: string;
  role: 'Winner' | 'Runner up' | 'Participant';
  event: string;
  certificateId: string;
}

export interface Coordinator {
  id: string;
  name: string;
  email: string;
  coordinatorId: string;
  role: 'Student Coordinator';
}

export type UserRole = 'Winner' | 'Runner up' | 'Participant' | 'Student Coordinator';
