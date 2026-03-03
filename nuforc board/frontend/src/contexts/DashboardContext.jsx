import { createContext, useContext } from "react";
import { useDashboardState } from "../hooks/useDashboardState";

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const dashboard = useDashboardState();
  return (
    <DashboardContext.Provider value={dashboard}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
