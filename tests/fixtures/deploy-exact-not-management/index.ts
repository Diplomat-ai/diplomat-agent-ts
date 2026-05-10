/**
 * Fixture: deploy-exact-not-management
 *
 * Regression guard for the deploy pattern precision fix (SPEC FIX 5).
 * Functions that *manage* deployments (cancel, get, list, redeploy) must NOT
 * be classified as publish operations — they are read/control operations.
 * Only a bare deploy() call is a genuine publish side-effect.
 */

// Simulated @mastra/deployer-style management API (these must NOT be flagged)
declare const deployer: {
  cancelDeploy(id: string): Promise<void>;
  getDeployStatus(id: string): Promise<string>;
  listDeployments(): Promise<unknown[]>;
  redeployApp(id: string): Promise<void>;
  getDeploymentLogs(id: string): Promise<string[]>;
};

export async function cancel(id: string) {
  return deployer.cancelDeploy(id);
}

export async function status(id: string) {
  return deployer.getDeployStatus(id);
}

export async function list() {
  return deployer.listDeployments();
}

export async function redeploy(id: string) {
  return deployer.redeployApp(id);
}

export async function logs(id: string) {
  return deployer.getDeploymentLogs(id);
}

// This bare deploy() SHOULD be flagged as publish
declare function deploy(config: unknown): Promise<void>;

export async function publishApp(config: unknown) {
  return deploy(config);
}
