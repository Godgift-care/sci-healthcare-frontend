/** The seven-character commit identifier baked into this build. */
export function buildCommit(env: Record<string, string | undefined>): string {
  const commit = env.VERCEL_GIT_COMMIT_SHA?.trim() || env.GITHUB_SHA?.trim();
  return commit?.slice(0, 7) ?? '';
}
