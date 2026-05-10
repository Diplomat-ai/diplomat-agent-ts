import paypal from "@paypal/checkout-server-sdk";

export async function capturePaypalOrder(orderId: string) {
  const client = new paypal.core.PayPalHttpClient(
    new paypal.core.SandboxEnvironment("id", "secret")
  );
  const request = new paypal.orders.OrdersCaptureRequest(orderId);
  return client.execute(request);
}
