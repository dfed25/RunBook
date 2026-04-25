export type EmbedProject = {
  id: string;
  name: string;
  ownerGitHubId: number;
  ownerGitHubLogin: string;
  githubRepoFullName: string;
  defaultBranch: string;
  siteUrl?: string;
  createdAt: string;
  updatedAt: string;
  lastIndexStatus?: "idle" | "running" | "ok" | "error";
  lastIndexError?: string;
  lastIndexedAt?: string;
  lastIndexStats?: { files: number; chunks: number; bytes: number };
};

export type EmbedApiKeyRecord = {
  id: string;
  projectId: string;
  /** sha256 hex of full key including rk_ prefix */
  keyHash: string;
  /** first 12 chars after rk_ for display */
  keyPrefix: string;
  createdAt: string;
  revokedAt?: string;
};

export type EmbedGitHubToken = {
  githubId: number;
  login: string;
  accessToken: string;
  createdAt: string;
};
