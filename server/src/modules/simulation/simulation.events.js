/**
 * SyncExc Server — Simulation events
 */

export const SIMULATION_EMITS = [
  'simulation.environment_created',
  'simulation.run_started',
  'simulation.run_completed',
  'simulation.run_failed',
];

export const SIMULATION_CONSUMES = [];

export default {
  SIMULATION_EMITS,
  SIMULATION_CONSUMES,
};