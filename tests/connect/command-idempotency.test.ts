import { describe, it, expect, beforeEach } from 'vitest';
import { CommandValidator } from '../../src/lib/connect/CommandValidator';
import { CommandSequencer } from '../../src/lib/connect/CommandSequencer';
import { ConnectCommand } from '../../src/lib/connect/types';

describe('Command Idempotency & Deduplication Tests', () => {
  beforeEach(() => {
    CommandSequencer.getInstance().setEpoch(1);
    CommandValidator.getInstance().setRevision(1);
  });

  it('should process a command once and reject subsequent duplicate attempts with identical commandId', () => {
    const validator = CommandValidator.getInstance();
    
    const command: ConnectCommand = {
      commandId: 'unique_cmd_id_99',
      sessionId: 'sess_1',
      epoch: 1,
      revision: 2,
      sequence: 1,
      sourceDeviceId: 'dev_mobile',
      type: 'PLAY',
      sentAt: Date.now(),
      payload: {}
    };

    // First attempt -> Valid
    const firstExecution = validator.validate(command);
    expect(firstExecution).toBe(true);

    // Second attempt with exact same commandId -> Rejected as duplicate
    const secondExecution = validator.validate(command);
    expect(secondExecution).toBe(false);
  });
});
