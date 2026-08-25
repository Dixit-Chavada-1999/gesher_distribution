/**
 * Auth Callback Route
 *
 * Handles OAuth callbacks and email confirmation redirects from Supabase.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';
  const error_description = searchParams.get('error_description');

  // Handle Supabase error redirects (e.g., expired or invalid link)
  if (error_description) {
    console.error('Auth callback error from Supabase:', error_description);
    const errorMessage = encodeURIComponent(error_description);
    return NextResponse.redirect(`${origin}/login?error=${errorMessage}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Successful authentication
      return NextResponse.redirect(`${origin}${next}`);
    }

    // Log the specific error for debugging
    console.error('Code exchange error:', {
      message: error.message,
      code: error.code,
      status: error.status,
    });

    // Provide more specific error messages
    if (error.message.includes('expired')) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('This link has expired. Please request a new password reset.')}`
      );
    }

    if (error.message.includes('already been used')) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('This link has already been used. Please request a new password reset.')}`
      );
    }

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message || 'Authentication failed. Please try again.')}`
    );
  }

  // No code provided
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Invalid authentication link.')}`);
}
