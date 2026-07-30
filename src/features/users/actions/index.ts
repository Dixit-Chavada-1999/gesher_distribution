/**
 * Users Server Actions
 *
 * Server actions for the Users module.
 * Can be called directly from Server Components or from client components.
 */

'use server';

import { revalidatePath } from 'next/cache';

import { userService } from '../services/user.service';
import { resolveActor } from '../lib/require-actor';
import {
  createUserSchema,
  updateUserSchema,
  changeUserRoleSchema,
  adminResetPasswordSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from '../lib/schemas';
import type {
  User,
  UserWithRole,
  UserListParams,
  UserStatusCounts,
} from '../types';

// ============================================
// TYPES
// ============================================

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

const USERS_PATH = '/users';

/**
 * Every action resolves the caller to their own `users` row, because the
 * service compares the actor against the target ("you cannot delete yourself").
 * A raw Supabase auth id would never match and the guard would be dead code.
 */
async function requireActor(): Promise<
  { ok: true; actorId: string } | { ok: false; result: ActionResult<never> }
> {
  const { actor, reason } = await resolveActor();

  if (!actor) {
    return {
      ok: false,
      result: {
        success: false,
        error:
          reason === 'no-profile'
            ? 'Your account is no longer active'
            : 'Authentication required',
      },
    };
  }

  return { ok: true, actorId: actor.id };
}

// ============================================
// LIST ACTIONS
// ============================================

/**
 * Get paginated list of users
 */
export async function getUsers(
  params: UserListParams = {}
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  return userService.list(params);
}

/**
 * Get a single user by ID
 */
export async function getUser(id: string): Promise<ActionResult<UserWithRole>> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  return userService.getById(id);
}

/**
 * Get user counts by status
 */
export async function getUserStatusCounts(): Promise<
  ActionResult<UserStatusCounts>
> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  return userService.getStatusCounts();
}

// ============================================
// MUTATION ACTIONS
// ============================================

/**
 * Create a new user together with its Supabase Auth account
 */
export async function createUser(
  input: CreateUserInput
): Promise<ActionResult<User>> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  const validation = createUserSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const result = await userService.create(validation.data, auth.actorId);

  if (result.success) {
    revalidatePath(USERS_PATH);
  }

  return result;
}

/**
 * Update an existing user
 */
export async function updateUser(
  id: string,
  input: UpdateUserInput
): Promise<ActionResult<User>> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  const validation = updateUserSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const result = await userService.update(id, validation.data, auth.actorId);

  if (result.success) {
    revalidatePath(USERS_PATH);
    revalidatePath(`${USERS_PATH}/${id}`);
  }

  return result;
}

/**
 * Change a user's role
 */
export async function changeUserRole(
  id: string,
  roleId: string
): Promise<ActionResult<User>> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  if (auth.actorId === id) {
    return { success: false, error: 'You cannot change your own role' };
  }

  const validation = changeUserRoleSchema.safeParse({ roleId });
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const result = await userService.changeRole(
    id,
    validation.data,
    auth.actorId
  );

  if (result.success) {
    revalidatePath(USERS_PATH);
  }

  return result;
}

/**
 * Soft delete a user
 */
export async function deleteUser(id: string): Promise<ActionResult<User>> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  const result = await userService.delete(id, auth.actorId);

  if (result.success) {
    revalidatePath(USERS_PATH);
  }

  return result;
}

/**
 * Restore a soft-deleted user
 */
export async function restoreUser(id: string): Promise<ActionResult<User>> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  const result = await userService.restore(id, auth.actorId);

  if (result.success) {
    revalidatePath(USERS_PATH);
  }

  return result;
}

// ============================================
// PASSWORD ACTIONS
// ============================================

/**
 * Email a password reset link to a user
 */
export async function sendUserPasswordReset(
  id: string
): Promise<ActionResult<null>> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  return userService.sendPasswordReset(id);
}

/**
 * Set a user's password directly (admin-initiated)
 */
export async function setUserPassword(
  id: string,
  password: string
): Promise<ActionResult<null>> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  const validation = adminResetPasswordSchema.safeParse({ password });
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  return userService.setPassword(id, validation.data.password);
}

// ============================================
// VALIDATION ACTIONS
// ============================================

/**
 * Check whether an email is still available
 */
export async function validateUserEmail(
  email: string,
  excludeId?: string
): Promise<ActionResult<boolean>> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }

  return userService.validateEmail(email, excludeId);
}
