import type { Adapters } from './sense.ts';

/**
 * SIMULATED adapters for test runs in Vision Studio. No camera, no AI model, nothing is saved or
 * spoken. Outputs are canned so a workflow's logic can be checked. Never present as real results.
 */
export function createSimulatedAdapters(opts: { damage: boolean }, log: string[] = []): Adapters {
  const text = opts.damage ? 'Simulated: visible damage near the left valve.' : 'Simulated: surface looks normal.';
  return {
    capture: async () => ({ imageRef: 'simulated://image', source: 'demo_session' }),
    describe: async () => ({ text }),
    ocr: async () => ({ text: 'Simulated: EXIT' }),
    ask: async () => ({ text }),
    speak: async (t) => { log.push(`(would speak) ${t}`); },
    notify: async (title) => { log.push(`(would notify) ${title}`); },
    saveRecord: async (r) => { log.push(`(would save) ${JSON.stringify(r)}`); return { id: 'simulated-record' }; },
    createTask: async (t) => { log.push(`(would create task) ${t}`); return { id: 'simulated-task' }; },
    searchMemory: async () => [],
  };
}
