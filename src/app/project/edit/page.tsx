import { Suspense } from "react";
import { EditProjectScreen } from "./EditProjectScreen";

export default function EditProjectPage() {
  return (
    <Suspense>
      <EditProjectScreen />
    </Suspense>
  );
}
