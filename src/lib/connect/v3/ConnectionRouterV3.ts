'use client';

import { RoutingDecisionV3 } from './types';

export interface RouteContextV3 {
  sourceAccountId?: string;
  targetAccountId?: string;
  sameLocalNetwork: boolean;
  lanAvailable: boolean;
  cloudAvailable: boolean;
  isPaired: boolean;
  isAuthorized: boolean;
}

export class ConnectionRouterV3 {
  private static instance: ConnectionRouterV3;

  private constructor() {}

  public static getInstance(): ConnectionRouterV3 {
    if (!ConnectionRouterV3.instance) {
      ConnectionRouterV3.instance = new ConnectionRouterV3();
    }
    return ConnectionRouterV3.instance;
  }

  /**
   * Evaluates the authoritative transport routing decision
   * adhering strictly to Phase 13 Connection Routing Rules.
   */
  public evaluateRoute(ctx: RouteContextV3): RoutingDecisionV3 {
    const isSameAccount =
      !!ctx.sourceAccountId &&
      !!ctx.targetAccountId &&
      ctx.sourceAccountId === ctx.targetAccountId;

    // Rule 1: Same account + Same Wi-Fi + LAN Available -> LAN preferred
    if (isSameAccount && ctx.sameLocalNetwork && ctx.lanAvailable) {
      return 'LAN';
    }

    // Rule 2: Same account + Different network + Cloud Available -> CLOUD
    if (isSameAccount && !ctx.sameLocalNetwork && ctx.cloudAvailable) {
      return 'CLOUD';
    }

    // Rule 3: Same account + Same Wi-Fi + LAN Failed -> CLOUD fallback
    if (isSameAccount && ctx.sameLocalNetwork && !ctx.lanAvailable && ctx.cloudAvailable) {
      return 'CLOUD';
    }

    // Rule 4: Different account + Same Wi-Fi + NOT paired -> PAIR_FIRST
    if (!isSameAccount && ctx.sameLocalNetwork && !ctx.isPaired) {
      return 'PAIR_FIRST';
    }

    // Rule 5: Different account + Same Wi-Fi + Paired & Authorized -> LAN
    if (!isSameAccount && ctx.sameLocalNetwork && ctx.isPaired && ctx.isAuthorized && ctx.lanAvailable) {
      return 'LAN';
    }

    // Rule 6: Different account + Different network -> UNAVAILABLE
    if (!isSameAccount && !ctx.sameLocalNetwork) {
      return 'UNAVAILABLE';
    }

    return 'UNAVAILABLE';
  }
}
