import { RawAudioFocusEvent, InterruptionClass } from './types';

export class InterruptionClassifier {
  /**
   * Classifies raw platform audio focus events into operational Interruption Classes:
   * - DUCK: Volume ↓, continue playing (notifications, navigation prompts)
   * - PAUSE_TRANSIENT_RESUMABLE: Pause, save snapshot, auto-resume eligible (phone call, alarm)
   * - PAUSE_PERMANENT: Pause, clear auto-resume eligibility (competing music app, manual user pause)
   */
  public static classify(event: RawAudioFocusEvent): InterruptionClass | 'RESTORE_GAIN' | 'IGNORE' {
    switch (event.type) {
      case 'LOSS_DUCK':
        return 'DUCK';

      case 'LOSS_TRANSIENT':
        if (event.reason === 'NOTIFICATION' || event.reason === 'NAVIGATION') {
          return 'DUCK';
        }
        return 'PAUSE_TRANSIENT_RESUMABLE';

      case 'LOSS':
        return 'PAUSE_PERMANENT';

      case 'GAIN':
      case 'GAIN_TRANSIENT_END':
        return 'RESTORE_GAIN';

      default:
        return 'IGNORE';
    }
  }
}
