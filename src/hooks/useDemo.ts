import { useContext } from "react";
import { DemoContext } from "../app/demo-context";

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("DemoProvider is required.");
  return context;
}
