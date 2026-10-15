import { createIdentityModule } from './identity/index.js';
import { createWorkspacesModule } from './workspaces/index.js';
import { createBillingModule } from './billing/index.js';
import { createConnectionsModule } from './connections/index.js';
import { createRiskModule } from './risk/index.js';
import { createTerminalModule } from './terminal/index.js';
import { createSynchronizationModule } from './synchronization/index.js';
import { createSourcesModule } from './sources/index.js';
import { createSignalsModule } from './signals/index.js';
import { createMarketplaceModule } from './marketplace/index.js';
import { createAutomationModule } from './automation/index.js';
import { createSimulationModule } from './simulation/index.js';
import { createReferralModule } from './referral/index.js';
import { createDeveloperModule } from './developer/index.js';
import { createCommunityModule } from './community/index.js';
import { createNotificationsModule } from './notifications/index.js';
import { createSupportModule } from './support/index.js';
import { createIncidentsModule } from './incidents/index.js';
import { createAdminModule } from './admin/index.js';

const MODULE_FACTORIES = [
  createIdentityModule,
  createWorkspacesModule,
  createBillingModule,
  createConnectionsModule,
  createRiskModule,
  createTerminalModule,
  createSynchronizationModule,
  createSourcesModule,
  createSignalsModule,
  createMarketplaceModule,
  createAutomationModule,
  createSimulationModule,
  createReferralModule,
  createDeveloperModule,
  createCommunityModule,
  createNotificationsModule,
  createSupportModule,
  createIncidentsModule,
  createAdminModule,
];

export function initializeModules(services) {
  const modules = {};
  services.modules = modules;

  for (const createModule of MODULE_FACTORIES) {
    const module = createModule({ services });
    modules[module.name] = module;
    services[module.name] = Object.assign(module, module.publicApi ?? {});
    if (module.name === 'identity') {
      services.session = module.publicApi.sessionService;
    }
  }

  return modules;
}

export default initializeModules;
