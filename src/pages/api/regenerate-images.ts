import { regenerateImages } from "../../lib/regenerateImages";

export const POST = async () => {
  const result = await regenerateImages();

  if (!result.success) {
    return new Response(JSON.stringify(result), { status: 500 });
  }

  return new Response(JSON.stringify(result), { status: 200 });
};