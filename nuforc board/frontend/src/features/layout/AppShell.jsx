import { useState } from "react";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { MotionProvider, useMotionConfig } from "../../contexts/MotionContext";
import Sidebar from "./Sidebar";

function AppShellInner({ sidebar, children }) {
  const { transition } = useMotionConfig();
  const sidebarCollapsed = sidebar.collapsed;

  return (
    <MotionConfig reducedMotion="user" transition={transition}>
      <div className="vitrine-shard vitrine-shard-a" />
      <div className="vitrine-shard vitrine-shard-b" />

      <div className="flex min-h-screen">
        <Sidebar {...sidebar} />

        <div
          className={`flex min-h-screen w-full flex-col transition-[margin] duration-200 ${
            sidebarCollapsed ? "md:ml-16" : "md:ml-[240px]"
          }`}
        >
          {children}
        </div>
      </div>
    </MotionConfig>
  );
}

export default function AppShell({ sidebar, children }) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionProvider>
        <AppShellInner sidebar={sidebar}>{children}</AppShellInner>
      </MotionProvider>
    </LazyMotion>
  );
}
