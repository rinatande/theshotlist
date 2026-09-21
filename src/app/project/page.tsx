import { Suspense } from "react";
import { ProjectScreen } from "./ProjectScreen";

export default function ProjectPage() {
  return (
    <Suspense>
      <ProjectScreen />
    </Suspense>
  );
}
