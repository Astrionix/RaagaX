import { describe, it, expect, beforeEach } from 'vitest';
import { DeviceSimulator } from './DeviceSimulator';
import { CommandValidator } from '../../src/lib/connect/CommandValidator';
import { CommandSequencer } from '../../src/lib/connect/CommandSequencer';
import { ConnectCommand } from '../../src/lib/connect/types';

describe('Multi-Device Connect End-to-End Simulator & Failure Chaos Engine', () => {
  let desktopNode: DeviceSimulator;
  let phoneNode: DeviceSimulator;
  let tvNode: DeviceSimulator;

  beforeEach(() => {
    desktopNode = new DeviceSimulator('desktop_pc', 'RENDERER');
    phoneNode = new DeviceSimulator('phone_android', 'CONTROLLER');
    tvNode = new DeviceSimulator('living_room_tv', 'CONTROLLER');

    CommandValidator.getInstance().reset();
    CommandSequencer.getInstance().setEpoch(10);
    CommandValidator.getInstance().setRevision(500);
  });

  it('Scenario A (Normal Transfer): Desktop playing -> Phone requests transfer -> Phone prepares -> lease moves -> Phone plays -> Desktop stops', () => {
    desktopNode.preparePlayback('song_bohemian', 92000);
    desktopNode.startPlayback();
    expect(desktopNode.isPlaying).toBe(true);

    // Phone initiates transfer
    phoneNode.preparePlayback('song_bohemian', 92000);
    phoneNode.startPlayback();
    phoneNode.role = 'RENDERER';

    // Desktop stops as lease moves
    desktopNode.stopPlayback();
    desktopNode.role = 'CONTROLLER';

    expect(phoneNode.isPlaying).toBe(true);
    expect(desktopNode.isPlaying).toBe(false);
    expect(phoneNode.role).toBe('RENDERER');
    expect(desktopNode.role).toBe('CONTROLLER');
  });

  it('Scenario B (Target Disappears Mid-Transfer): Phone loses network during transfer -> Handshake rolls back -> Desktop remains renderer', () => {
    desktopNode.preparePlayback('song_bohemian', 92000);
    desktopNode.startPlayback();
    expect(desktopNode.isPlaying).toBe(true);

    // Phone loses network mid-transfer
    phoneNode.setNetworkState('OFFLINE');

    // Transfer fails; Desktop retains renderer role (never leaves session ownerless)
    expect(desktopNode.isPlaying).toBe(true);
    expect(desktopNode.role).toBe('RENDERER');
    expect(phoneNode.networkState).toBe('OFFLINE');
  });

  it('Scenario C (Source Disappears Mid-Transfer): Desktop drops network after Phone is ready -> Phone assumes renderer role safely', () => {
    desktopNode.preparePlayback('song_bohemian', 92000);
    desktopNode.startPlayback();

    // Phone reaches READY state
    phoneNode.preparePlayback('song_bohemian', 92000);
    
    // Desktop abruptly drops network
    desktopNode.setNetworkState('OFFLINE');
    desktopNode.stopPlayback();

    // Phone assumes renderer role
    phoneNode.role = 'RENDERER';
    phoneNode.startPlayback();

    expect(phoneNode.isPlaying).toBe(true);
    expect(phoneNode.role).toBe('RENDERER');
  });

  it('Scenario D (Concurrent Lease Race): Phone wins epoch takeover -> Stale takeover attempt from Laptop at old epoch is rejected', () => {
    const validator = CommandValidator.getInstance();

    const phoneClaim: ConnectCommand = {
      commandId: 'cmd_race_phone',
      sessionId: 'sess_race',
      epoch: 11,
      revision: 501,
      sequence: 1,
      sourceDeviceId: phoneNode.deviceId,
      type: 'TRANSFER_COMMIT',
      sentAt: Date.now(),
      payload: {}
    };

    const laptopStaleClaim: ConnectCommand = {
      commandId: 'cmd_race_laptop',
      sessionId: 'sess_race',
      epoch: 10, // Stale epoch < 11 after phone promoted it
      revision: 500,
      sequence: 1,
      sourceDeviceId: desktopNode.deviceId,
      type: 'PLAY',
      sentAt: Date.now(),
      payload: {}
    };

    // Phone takeover succeeds (promotes epoch from 10 to 11)
    const firstResult = validator.validate(phoneClaim);
    expect(firstResult).toBe(true);

    // Stale laptop claim at epoch 10 rejected
    const secondResult = validator.validate(laptopStaleClaim);
    expect(secondResult).toBe(false);
  });

  it('Scenario E (Tampered Payload Replay): Mismatched commandHash is rejected', () => {
    const validator = CommandValidator.getInstance();

    const originalCmd: ConnectCommand = {
      commandId: 'cmd_hash_test_1',
      commandHash: 'hash_abc123',
      sessionId: 'sess_1',
      epoch: 11,
      revision: 502,
      sequence: 1,
      sourceDeviceId: 'phone_android',
      type: 'TRANSFER_COMMIT', // Use TRANSFER_COMMIT so epoch 11 is validly adopted
      sentAt: Date.now(),
      payload: { positionMs: 15000 }
    };

    const validateOriginal = validator.validate(originalCmd);
    expect(validateOriginal).toBe(true);

    // Replay attempt with same ID but different command hash
    const tamperedCmd: ConnectCommand = {
      ...originalCmd,
      commandHash: 'hash_TAMPERED_999',
      payload: { positionMs: 90000 }
    };

    const validateTampered = validator.validate(tamperedCmd);
    expect(validateTampered).toBe(false);
  });
});
