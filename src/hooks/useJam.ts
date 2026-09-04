"use client";

import { useEffect, useState, useCallback } from "react";
import { JamSessionManager, JamState } from "@/lib/jam/JamSessionManager";
import { Song } from "@/types/music";

export function useJam() {
  const [jamState, setJamState] = useState<JamState>(JamSessionManager.getInstance().getState());
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string>("");

  useEffect(() => {
    const unsub = JamSessionManager.getInstance().subscribe((state) => {
      setJamState(state);
    });
    return unsub;
  }, []);

  const startJam = useCallback(async () => {
    const res = await JamSessionManager.getInstance().startJam();
    setInviteUrl(res.inviteUrl);
    setIsInviteModalOpen(true);
    return res;
  }, []);

  const joinJam = useCallback(async (pin: string) => {
    const ok = await JamSessionManager.getInstance().joinJam(pin);
    return ok;
  }, []);

  const leaveJam = useCallback(() => {
    JamSessionManager.getInstance().leaveJam();
    setIsInviteModalOpen(false);
  }, []);

  const addTrackToJam = useCallback(async (track: Song) => {
    await JamSessionManager.getInstance().addTrackToJam(track);
  }, []);

  const setAllowGuestControl = useCallback((allow: boolean) => {
    JamSessionManager.getInstance().setAllowGuestControl(allow);
  }, []);

  return {
    ...jamState,
    inviteUrl,
    isInviteModalOpen,
    setIsInviteModalOpen,
    startJam,
    joinJam,
    leaveJam,
    addTrackToJam,
    setAllowGuestControl,
  };
}
