'use client';

import React from 'react';

interface PlatformAdminSkinProps {
  workspaceName: string;
  activeWorkspace: any;
  platformTab: string;
  onNotify: (msg: string) => void;
  children?: React.ReactNode;
}

export function PlatformAdminSkin({
  workspaceName,
  activeWorkspace,
  platformTab,
  onNotify,
  children,
}: PlatformAdminSkinProps) {
  return (
    <div className="space-y-6">
      {/* Control Plane AI Sentinel for Platform Owners when in AI tab */}
      {children}
    </div>
  );
}

