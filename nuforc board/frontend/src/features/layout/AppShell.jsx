import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { MotionProvider, useMotionConfig } from "../../contexts/MotionContext";
import { modeStyleVars } from "../../lib/modeTheme";
import Sidebar from "./Sidebar";

function AppShellInner({ sidebar, children }) {
  const { transition } = useMotionConfig();
  const sidebarCollapsed = sidebar.collapsed;

  return (
    <MotionConfig reducedMotion="user" transition={transition}>
      <div className="flex min-h-screen" style={modeStyleVars(sidebar.mode)}>
        <Sidebar {...sidebar} />

        <div
          className={`flex min-h-screen w-full flex-col transition-[margin] duration-200 ${
            sidebarCollapsed ? "md:ml-16" : "md:ml-[220px]"
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
