import { describe, it, expect, beforeEach } from 'vitest';
import { CommandValidator } from '../../src/lib/connect/CommandValidator';
import { CommandSequencer } from '../../src/lib/connect/CommandSequencer';
import { ConnectCommand } from '../../src/lib/connect/types';

describe('CommandValidator State Revision Tests', () => {
  beforeEach(() => {
    CommandSequencer.getInstance().setEpoch(1);
    CommandValidator.getInstance().setRevision(100);
  });

  it('should reject commands with stale state revision < current session revision', () => {
    const validator = CommandValidator.getInstance();
    
    const staleRevisionCmd: ConnectCommand = {
      commandId: 'cmd_rev_stale',
      sessionId: 'sess_1',
      epoch: 1,
      revision: 95, // Stale revision < 100
      sequence: 1,
      sourceDeviceId: 'dev_1',
      type: 'PAUSE',
      sentAt: Date.now(),
      payload: {}
    };

    expect(validator.validate(staleRevisionCmd)).toBe(false);
  });

  it('should accept command with newer revision and update validator current revision', () => {
    const validator = CommandValidator.getInstance();
    
    const validRevCmd: ConnectCommand = {
      commandId: 'cmd_rev_fresh',
      sessionId: 'sess_1',
      epoch: 1,
      revision: 101,
      sequence: 2,
      sourceDeviceId: 'dev_1',
      type: 'SEEK',
      sentAt: Date.now(),
      payload: { positionMs: 15000 }
    };

    expect(validator.validate(validRevCmd)).toBe(true);
  });
});
