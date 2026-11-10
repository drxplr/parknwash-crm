function details(error: unknown) {
  const value = error && typeof error === 'object' ? (error as Record<string, unknown>) : {}
  return {
    status: Number(value.status ?? 0),
    code: String(value.code ?? ''),
    name: String(value.name ?? ''),
    message: String(value.message ?? error ?? ''),
  }
}
export function isTemporaryConnectionError(error: unknown) {
  const value = details(error)
  if (value.status >= 400 && value.status < 500 && value.status !== 408) return false
  return (
    [408, 502, 503, 504].includes(value.status) ||
    value.name === 'AuthRetryableFetchError' ||
    /failed to fetch|load failed|networkerror|network request failed|fetch failed|connection.*(?:lost|closed)|timed? out/i.test(
      value.message,
    )
  )
}
// Used only during sign-in/startup. CRM writes and email-link sends are never replayed.
export async function retryConnectionOnce<T>(
  operation: () => Promise<T>,
  isCurrent: () => boolean,
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (!isCurrent() || !isTemporaryConnectionError(error)) throw error
    await new Promise((resolve) => setTimeout(resolve, 600))
    if (!isCurrent()) throw error
    return operation()
  }
}
export function authErrorMessage(error: unknown, phase: 'sign-in' | 'workspace') {
  const value = details(error)
  if (isTemporaryConnectionError(error))
    return phase === 'workspace'
      ? 'Your sign-in succeeded, but the workspace connection was interrupted. Retry loading your workspace.'
      : 'The sign-in connection was interrupted. Please check your connection and try again.'
  if (value.code === 'invalid_credentials') return 'Email or password is incorrect.'
  if (value.status === 429) return 'Too many attempts. Wait a moment before trying again.'
  return value.message || 'Unable to connect. Please try again.'
}

// The SDK returns auth errors as values. Retry only a lost connection, once;
// never repeat invalid credentials, unconfirmed emails or rate-limited attempts.
export async function retryPasswordSignIn<T extends { error: unknown }>(
  operation: () => Promise<T>,
  isCurrent: () => boolean,
): Promise<T> {
  return retryConnectionOnce(async () => {
    const result = await operation()
    if (result.error && isTemporaryConnectionError(result.error)) throw result.error
    return result
  }, isCurrent)
}
