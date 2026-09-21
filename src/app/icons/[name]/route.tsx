import { renderIcon } from "@/lib/icon";

// Fixed URLs for the manifest's icons, rendered once at build time.
const SIZES: Record<string, number> = {
  "icon-192.png": 192,
  "icon-512.png": 512,
  "maskable-512.png": 512,
};

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(SIZES).map((name) => ({ name }));
}

export async function GET(_request: Request, { params }: RouteContext<"/icons/[name]">) {
  const { name } = await params;
  return renderIcon(SIZES[name]);
}
