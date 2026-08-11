import { describe, it, expect, beforeEach } from 'vitest';
import { CommandValidator } from '../../src/lib/connect/CommandValidator';
import { CommandSequencer } from '../../src/lib/connect/CommandSequencer';
import { ConnectCommand } from '../../src/lib/connect/types';

describe('CommandValidator Epoch Fencing Tests', () => {
  beforeEach(() => {
    CommandSequencer.getInstance().setEpoch(5);
  });

  it('should reject commands with stale epoch < current epoch', () => {
    const validator = CommandValidator.getInstance();
    
    const staleCommand: ConnectCommand = {
      commandId: 'cmd_1',
      sessionId: 'sess_1',
      epoch: 4, // Stale epoch < 5
      sequence: 10,
      sourceDeviceId: 'dev_remote',
      type: 'PLAY',
      sentAt: Date.now(),
      payload: {}
    };

    expect(validator.validate(staleCommand)).toBe(false);
  });

  it('should reject unauthorized epoch promotion from standard PLAY command', () => {
    const validator = CommandValidator.getInstance();
    
    const unauthorizedCmd: ConnectCommand = {
      commandId: 'cmd_2',
      sessionId: 'sess_1',
      epoch: 6, // Client attempting self-promotion
      sequence: 1,
      sourceDeviceId: 'dev_remote',
      type: 'PLAY',
      sentAt: Date.now(),
      payload: {}
    };

    expect(validator.validate(unauthorizedCmd)).toBe(false);
  });

  it('should accept valid epoch promotion from TRANSFER_COMMIT command', () => {
    const validator = CommandValidator.getInstance();
    
    const commitCmd: ConnectCommand = {
      commandId: 'cmd_3',
      sessionId: 'sess_1',
      epoch: 6,
      sequence: 1,
      sourceDeviceId: 'dev_remote',
      type: 'TRANSFER_COMMIT',
      sentAt: Date.now(),
      payload: {}
    };

    expect(validator.validate(commitCmd)).toBe(true);
    expect(CommandSequencer.getInstance().getEpoch()).toBe(6);
  });
});
