import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dynamicIslandCapability, DynamicIslandCapability } from '@/lib/capabilities/DynamicIslandCapabilityEngine';

interface DynamicIslandCapabilityStore {
  capability: DynamicIslandCapability;
  userEnabled: boolean;
  isAvailable: boolean;

  // Actions
  setUserEnabled: (enabled: boolean) => void;
  requestPermission: () => Promise<boolean>;
  refreshCapability: () => void;
}

const DEFAULT_CAPABILITY: DynamicIslandCapability = {
  isMobilePlatform: false,
  hasCutoutSupport: false,
  hasMediaSession: false,
  hasNotificationSupport: false,
  permissionState: 'unsupported',
  isHardwareSupported: false,
  isAvailable: false,
  statusMessage: 'Evaluating device capability...',
};

export const useDynamicIslandCapabilityStore = create<DynamicIslandCapabilityStore>()(
  persist(
    (set, get) => ({
      capability: typeof window !== 'undefined' ? dynamicIslandCapability.getCapability() : DEFAULT_CAPABILITY,
      userEnabled: true,
      isAvailable: false,

      setUserEnabled: (enabled: boolean) => {
        const state = get();
        const cap = state?.capability || dynamicIslandCapability.getCapability();
        set({
          userEnabled: enabled,
          isAvailable: cap.isAvailable && enabled,
        });
      },

      requestPermission: async () => {
        const granted = await dynamicIslandCapability.requestPermission();
        const updatedCap = dynamicIslandCapability.getCapability();
        const state = get();
        const userEnabled = state?.userEnabled !== false;
        set({
          capability: updatedCap,
          isAvailable: updatedCap.isAvailable && userEnabled,
        });
        return granted;
      },

      refreshCapability: () => {
        const cap = dynamicIslandCapability.getCapability();
        const state = get();
        const userEnabled = state?.userEnabled !== false;
        set({
          capability: cap,
          isAvailable: cap.isAvailable && userEnabled,
        });
      },
    }),
    {
      name: 'raagax-dynamic-island-capability-v2',
      partialize: (state) => ({ userEnabled: state.userEnabled }),
      onRehydrateStorage: () => (state) => {
        if (state && typeof window !== 'undefined') {
          const cap = dynamicIslandCapability.getCapability();
          state.capability = cap;
          state.isAvailable = cap.isAvailable && state.userEnabled !== false;
        }
      },
    }
  )
);

// Subscribe to live hardware & permission changes safely outside store creation
if (typeof window !== 'undefined') {
  dynamicIslandCapability.subscribe((cap) => {
    const store = useDynamicIslandCapabilityStore.getState();
    const userEnabled = store?.userEnabled !== false;
    useDynamicIslandCapabilityStore.setState({
      capability: cap,
      isAvailable: cap.isAvailable && userEnabled,
    });
  });
}
