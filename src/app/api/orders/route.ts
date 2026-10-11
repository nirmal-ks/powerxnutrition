import { errorResponse, json } from "@/lib/api";
import { placeOrder, type PlaceOrderInput } from "@/lib/orders";
import { revalidateStore } from "@/lib/server/revalidate";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PlaceOrderInput;
    const result = await placeOrder(body);
    if (!result.duplicate) revalidateStore(); // stock changed
    return json(result, result.duplicate ? 200 : 201);
  } catch (e) {
    return errorResponse(e);
  }
}
