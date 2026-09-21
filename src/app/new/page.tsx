import { Suspense } from "react";
import { NewProjectScreen } from "./NewProjectScreen";

export default function NewProjectPage() {
  return (
    <Suspense>
      <NewProjectScreen />
    </Suspense>
  );
}
