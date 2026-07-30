/**
 * Pipedrive OAuth Callback Route
 *
 * GET /api/pipedrive/callback
 *
 * Handles the OAuth callback from Pipedrive:
 * - Validates state parameter
 * - Exchanges code for tokens
 * - Fetches user info
 * - Stores encrypted tokens
 * - Redirects to settings page
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUser } from '@/shared/lib/supabase/server';
import { pipedriveProvider } from '@/modules/integrations/providers/crm/pipedrive';
import {
  STATE_COOKIE_NAME,
  PIPEDRIVE_REDIRECT_PATHS,
} from '@/modules/integrations/providers/crm/pipedrive';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // Extract callback parameters
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle user cancellation
  if (error === 'access_denied') {
    return NextResponse.redirect(`${origin}${PIPEDRIVE_REDIRECT_PATHS.CANCELLED}`);
  }

  // Handle other OAuth errors
  if (error) {
    console.error('Pipedrive OAuth error:', error, searchParams.get('error_description'));
    return NextResponse.redirect(`${origin}${PIPEDRIVE_REDIRECT_PATHS.TOKEN_ERROR}`);
  }

  // Validate required parameters
  if (!code || !state) {
    console.error('Missing required callback parameters');
    return NextResponse.redirect(`${origin}${PIPEDRIVE_REDIRECT_PATHS.TOKEN_ERROR}`);
  }

  // Validate state parameter against cookie
  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE_NAME)?.value;

  if (!savedState || savedState !== state) {
    console.error('State mismatch - possible CSRF attack');
    // Clear the cookie
    cookieStore.delete(STATE_COOKIE_NAME);
    return NextResponse.redirect(`${origin}${PIPEDRIVE_REDIRECT_PATHS.INVALID_STATE}`);
  }

  // Clear the state cookie
  cookieStore.delete(STATE_COOKIE_NAME);

  try {
    // Get current user ID (optional)
    const user = await getUser();
    const userId = user?.id;

    // Handle the OAuth callback using the provider
    await pipedriveProvider.handleOAuthCallback({ code }, userId);

    // Success - redirect to settings
    return NextResponse.redirect(`${origin}${PIPEDRIVE_REDIRECT_PATHS.SUCCESS}`);
  } catch (error) {
    console.error('Pipedrive callback handling failed:', error);
    return NextResponse.redirect(`${origin}${PIPEDRIVE_REDIRECT_PATHS.TOKEN_ERROR}`);
  }
}
